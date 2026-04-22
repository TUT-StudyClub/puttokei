"""Gemini API を使う LLM プロバイダー実装。"""

from __future__ import annotations

import asyncio
import time

from google.genai import Client, errors, types

from src.config import GeminiThinkingLevel, LLMSettings
from src.domain.services.llm_judge_service import (
    LLMJudgmentInput,
    LLMJudgmentOutput,
    LLMProvider,
    TokenUsage,
)
from src.infrastructure.llm.errors import (
    LLMAuthenticationError,
    LLMProviderError,
    LLMTimeoutError,
    LLMUnknownError,
)
from src.infrastructure.llm.gemini_schema import (
    build_response_json_schema,
    parse_response,
    to_domain_output,
)
from src.infrastructure.llm.prompts import build_prompt_pair

_MILLISECONDS_PER_SECOND = 1_000


class GeminiProvider(LLMProvider):
    """Gemini API を使って学習アウトプットを判定する。"""

    def __init__(
        self,
        *,
        client: Client,
        model: str,
        thinking_level: GeminiThinkingLevel,
        temperature: float,
        timeout_seconds: int,
    ) -> None:
        self.model = model
        self.temperature = temperature
        self.thinking_level = thinking_level
        self.timeout_seconds = timeout_seconds
        self._client = client
        self._response_json_schema = build_response_json_schema()

    @classmethod
    def from_settings(cls, settings: LLMSettings) -> GeminiProvider:
        """設定から GeminiProvider を組み立てる。"""

        if not settings.gemini_api_key.strip():
            raise LLMAuthenticationError(
                "Gemini API key is missing. Set LLM_GEMINI_API_KEY before using GeminiProvider."
            )

        return cls(
            client=Client(api_key=settings.gemini_api_key),
            model=settings.gemini_model,
            thinking_level=settings.gemini_thinking_level,
            temperature=settings.gemini_temperature,
            timeout_seconds=settings.timeout_seconds,
        )

    async def judge(self, input_data: LLMJudgmentInput) -> LLMJudgmentOutput:
        """Gemini に構造化出力を要求し、ドメインモデルへ詰め替えて返す。"""

        system_prompt, user_prompt = build_prompt_pair(input_data)
        started_at = time.perf_counter()
        response = await self._generate_content(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
        latency_ms = int((time.perf_counter() - started_at) * _MILLISECONDS_PER_SECOND)
        parsed = parse_response(response)
        return to_domain_output(
            parsed,
            model_name=self.model,
            latency_ms=latency_ms,
            token_usage=self._extract_token_usage(response),
        )

    async def _generate_content(self, *, system_prompt: str, user_prompt: str) -> object:
        """Gemini API を呼び出し、レスポンスを返す。"""

        try:
            return await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self.model,
                    contents=user_prompt,
                    config=self._build_generation_config(system_prompt),
                ),
                timeout=self.timeout_seconds,
            )
        except TimeoutError as exc:
            raise LLMTimeoutError("Gemini request timed out.") from exc
        except errors.ClientError as exc:
            raise LLMProviderError.from_status_code(exc.code, exc.message) from exc
        except errors.APIError as exc:
            raise LLMUnknownError(
                exc.message or "Gemini API returned an unexpected error."
            ) from exc

    def _build_generation_config(self, system_prompt: str) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_json_schema=self._response_json_schema,
            temperature=self.temperature,
            thinking_config=types.ThinkingConfig(thinking_level=self.thinking_level),
        )

    def _extract_token_usage(self, response: object) -> TokenUsage | None:
        usage_metadata = getattr(response, "usage_metadata", None)
        if usage_metadata is None:
            return None

        prompt_tokens = getattr(usage_metadata, "prompt_token_count", None)
        completion_tokens = getattr(usage_metadata, "candidates_token_count", None)
        if prompt_tokens is None or completion_tokens is None:
            return None

        return TokenUsage(
            prompt_tokens=int(prompt_tokens),
            completion_tokens=int(completion_tokens),
        )

"""Gemini API を使う LLM プロバイダー実装。"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Literal

from google.genai import Client, errors, types
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from src.domain.services.llm_judge_service import (
    BaseLLMProvider,
    LLMJudgmentInput,
    LLMJudgmentItem,
    LLMJudgmentOutput,
    TokenUsage,
)
from src.infrastructure.llm.base import (
    LLMAuthenticationError,
    LLMResponseParseError,
    LLMTimeoutError,
    LLMUnknownError,
    provider_error_from_status_code,
)
from src.infrastructure.llm.prompts.v1 import SYSTEM_PROMPT, build_v1_prompt

ThinkingLevel = Literal["MINIMAL", "LOW", "MEDIUM", "HIGH"]


class _GeminiJudgmentItemSchema(BaseModel):
    """Gemini から返る主張単位の判定スキーマ。"""

    model_config = ConfigDict(extra="forbid")

    claim: str
    correct: bool
    feedback: str


class _GeminiJudgmentOutputSchema(BaseModel):
    """Gemini から返る判定結果スキーマ。"""

    model_config = ConfigDict(extra="forbid")

    verdict: Literal["correct", "partial", "incorrect", "rejected"]
    score: int = Field(ge=0, le=100)
    items: list[_GeminiJudgmentItemSchema]
    advice: str


class GeminiProvider(BaseLLMProvider):
    """Gemini API を使って学習アウトプットを判定する。"""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-3-flash-preview",
        thinking_level: ThinkingLevel = "MEDIUM",
        temperature: float = 0.2,
        timeout_seconds: int = 30,
    ) -> None:
        if not api_key.strip():
            raise LLMAuthenticationError(
                "Gemini API key is missing. Set LLM_GEMINI_API_KEY before using GeminiProvider."
            )

        self.model = model
        self.temperature = temperature
        self.thinking_level = thinking_level
        self.timeout_seconds = timeout_seconds
        self._client = Client(api_key=api_key)
        self._response_json_schema = _GeminiJudgmentOutputSchema.model_json_schema()

    async def judge(self, input_data: LLMJudgmentInput) -> LLMJudgmentOutput:
        """Gemini に構造化出力を要求し、domain VO へ詰め替えて返す。"""

        system_prompt, user_prompt = self._build_prompt(input_data)
        started_at = time.perf_counter()

        try:
            response = await asyncio.wait_for(
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
            raise provider_error_from_status_code(exc.code, exc.message) from exc
        except errors.APIError as exc:
            raise LLMUnknownError(
                exc.message or "Gemini API returned an unexpected error."
            ) from exc
        except Exception as exc:
            raise LLMUnknownError("Gemini request failed unexpectedly.") from exc

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        parsed = self._parse_response(response)
        return LLMJudgmentOutput(
            verdict=parsed.verdict,
            score=parsed.score,
            items=[
                LLMJudgmentItem(
                    claim=item.claim,
                    correct=item.correct,
                    feedback=item.feedback,
                )
                for item in parsed.items
            ],
            advice=parsed.advice,
            provider_name="gemini",
            model_name=self.model,
            latency_ms=latency_ms,
            token_usage=self._extract_token_usage(response),
        )

    def _build_prompt(self, input_data: LLMJudgmentInput) -> tuple[str, str]:
        match input_data.prompt_version:
            case "v1":
                return SYSTEM_PROMPT, build_v1_prompt(input_data)
            case _:
                raise ValueError(f"Unsupported prompt version: {input_data.prompt_version}")

    def _build_generation_config(
        self, system_prompt: str
    ) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_json_schema=self._response_json_schema,
            temperature=self.temperature,
            thinking_config=types.ThinkingConfig(thinking_level=self.thinking_level),
        )

    def _parse_response(self, response: object) -> _GeminiJudgmentOutputSchema:
        response_text = getattr(response, "text", None)
        if not response_text:
            raise LLMResponseParseError("Gemini returned an empty response.")

        try:
            payload = json.loads(response_text)
            return _GeminiJudgmentOutputSchema.model_validate(payload)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            raise LLMResponseParseError("Failed to parse Gemini structured output.") from exc

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

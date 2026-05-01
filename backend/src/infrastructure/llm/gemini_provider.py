"""Gemini プロバイダー実装。"""

import base64
import json
from typing import Any

import httpx
from pydantic import ValidationError

from src.domain.services.llm_judge_service import LLMJudgeService, LLMProgressCallback
from src.domain.value_objects.judgment_result import JudgmentResult
from src.infrastructure.llm.prompts.image.v1 import (
    build_judgment_prompt as build_image_judgment_prompt,
)
from src.infrastructure.llm.prompts.schema import judgment_response_json_schema
from src.infrastructure.llm.prompts.text.v1 import (
    build_judgment_prompt as build_text_judgment_prompt,
)

_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

_MEDIA_RESOLUTION_VALUES: dict[str, str] = {
    "low": "MEDIA_RESOLUTION_LOW",
    "medium": "MEDIA_RESOLUTION_MEDIUM",
    "high": "MEDIA_RESOLUTION_HIGH",
}


class GeminiProviderError(RuntimeError):
    """Gemini API 呼び出し時のエラー。"""


class GeminiProvider(LLMJudgeService):
    """Gemini Developer API を使って学習アウトプットを判定する。"""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        temperature: float,
        timeout_seconds: float,
        thinking_level: str | None = None,
        image_media_resolution: str = "high",
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.timeout_seconds = timeout_seconds
        self.thinking_level = _normalize_thinking_level(thinking_level)
        self.image_media_resolution = _normalize_media_resolution(image_media_resolution)
        self.transport = transport

    async def judge_text(
        self,
        prompt_input: str,
        user_output: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        # Gemini の streaming chunk には text を持たないイベントが混ざることがある。
        # 判定失敗や過剰な進捗 DB 更新を避けるため、Gemini は安定した通常 API を使う。
        del progress_callback
        payload = self._build_text_payload(topic=prompt_input, user_output=user_output)
        return await self._post_generate_content(payload)

    async def judge_image(
        self,
        prompt_input: str,
        image_bytes: bytes,
        image_mime_type: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        del progress_callback
        payload = self._build_image_payload(
            topic=prompt_input,
            image_bytes=image_bytes,
            image_mime_type=image_mime_type,
        )
        return await self._post_generate_content(payload)

    async def _post_generate_content(self, payload: dict[str, Any]) -> JudgmentResult:
        url = f"{_API_BASE_URL}/{self.model}:generateContent"

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds,
                transport=self.transport,
            ) as client:
                response = await client.post(
                    url,
                    headers={
                        "x-goog-api-key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise GeminiProviderError(_format_http_error(exc)) from exc
        except httpx.HTTPError as exc:
            raise GeminiProviderError(f"Gemini API との通信に失敗しました: {exc}") from exc

        try:
            text = _extract_response_text(response.json())
            return JudgmentResult.model_validate_json(text)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as exc:
            raise GeminiProviderError(
                "Gemini のレスポンスを JudgmentResult として解釈できませんでした。"
            ) from exc

    def _build_text_payload(self, *, topic: str, user_output: str) -> dict[str, Any]:
        return {
            "contents": [
                {
                    "parts": [
                        {
                            "text": build_text_judgment_prompt(
                                topic=topic,
                                user_output=user_output,
                            )
                        }
                    ]
                }
            ],
            "generationConfig": self._build_generation_config(),
        }

    def _build_image_payload(
        self,
        *,
        topic: str,
        image_bytes: bytes,
        image_mime_type: str,
    ) -> dict[str, Any]:
        generation_config = self._build_generation_config()
        generation_config["mediaResolution"] = self.image_media_resolution
        encoded = base64.b64encode(image_bytes).decode("ascii")
        return {
            "contents": [
                {
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": image_mime_type,
                                "data": encoded,
                            }
                        },
                        {"text": build_image_judgment_prompt(topic=topic)},
                    ]
                }
            ],
            "generationConfig": generation_config,
        }

    def _build_generation_config(self) -> dict[str, Any]:
        generation_config: dict[str, Any] = {
            "temperature": self.temperature,
            "responseMimeType": "application/json",
            "responseJsonSchema": judgment_response_json_schema(),
        }
        thinking_config = _build_thinking_config(
            model=self.model,
            thinking_level=self.thinking_level,
        )
        if thinking_config is not None:
            generation_config["thinkingConfig"] = thinking_config
        return generation_config


def _normalize_thinking_level(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip().lower()
    if normalized == "":
        return None

    allowed = {"minimal", "low", "medium", "high"}
    if normalized not in allowed:
        raise ValueError(f"unsupported Gemini thinking level: {value}")
    return normalized


def _normalize_media_resolution(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in _MEDIA_RESOLUTION_VALUES:
        raise ValueError(f"unsupported Gemini media resolution: {value}")
    return _MEDIA_RESOLUTION_VALUES[normalized]


def _build_thinking_config(*, model: str, thinking_level: str | None) -> dict[str, Any] | None:
    if thinking_level is None:
        return None
    if model.startswith("gemini-3"):
        return {"thinkingLevel": thinking_level}
    return None


def _extract_response_text(payload: dict[str, Any]) -> str:
    parts = payload["candidates"][0]["content"]["parts"]
    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
    if text == "":
        raise KeyError("response text is empty")
    return _strip_code_fence(text)


def _strip_code_fence(text: str) -> str:
    if not text.startswith("```"):
        return text

    lines = text.splitlines()
    if len(lines) < 3:
        return text
    if not lines[-1].startswith("```"):
        return text
    return "\n".join(lines[1:-1]).strip()


def _format_http_error(exc: httpx.HTTPStatusError) -> str:
    status = exc.response.status_code
    try:
        payload = exc.response.json()
    except json.JSONDecodeError:
        payload = None

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message:
                return f"Gemini API がエラーを返しました ({status}): {message}"

    return f"Gemini API がエラーを返しました ({status})。"

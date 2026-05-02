"""Vertex AI 経由で Gemini を呼ぶ LLMJudgeService 実装。

google-genai SDK を `vertexai=True` モードで初期化することで、ADC (Application
Default Credentials) を使ったサービスアカウント認証で Gemini multimodal API を
利用する。Developer API (API key 認証) は使わない。

ローカル開発: `GCS_CREDENTIALS_PATH` で指定したサービスアカウント鍵を読み込む。
Cloud Run 等: workload identity の SA を ADC として自動取得。

text / image どちらの判定も同一モデル / 同一 JSON Schema を使い、画像時のみ
inline_data + media_resolution を追加する。
"""

import asyncio
import json
from typing import Any

from google import genai
from google.genai import types
from google.oauth2 import service_account
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

_MEDIA_RESOLUTION_MAP: dict[str, types.MediaResolution] = {
    "low": types.MediaResolution.MEDIA_RESOLUTION_LOW,
    "medium": types.MediaResolution.MEDIA_RESOLUTION_MEDIUM,
    "high": types.MediaResolution.MEDIA_RESOLUTION_HIGH,
}


class VertexProviderError(RuntimeError):
    """Vertex AI 呼び出し時のエラー。"""


class VertexProvider(LLMJudgeService):
    """Vertex AI 経由で Gemini multimodal を叩く判定サービス。"""

    def __init__(
        self,
        *,
        project_id: str,
        location: str,
        model: str,
        temperature: float,
        timeout_seconds: float,
        thinking_budget: int | None = None,
        image_media_resolution: str = "high",
        credentials_path: str | None = None,
    ) -> None:
        self.model = model
        self.temperature = temperature
        self.timeout_seconds = timeout_seconds
        # google-genai SDK は thinking_level (categorical) を直接公開しておらず、
        # thinking_budget (token 数) でのみ制御可能。未指定ならモデル既定値に任せる。
        self.thinking_budget = thinking_budget
        self.image_media_resolution = _normalize_media_resolution(image_media_resolution)

        credentials = (
            service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            if credentials_path is not None
            else None
        )
        self._client = genai.Client(
            vertexai=True,
            project=project_id,
            location=location,
            credentials=credentials,
        )

    async def judge_text(
        self,
        prompt_input: str,
        user_output: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        # Gemini SDK は streaming もサポートするが、判定 progress は他 stage で
        # 既に細かく刻んでいるので、安定した非ストリーミング呼び出しで取得する。
        del progress_callback
        prompt = build_text_judgment_prompt(topic=prompt_input, user_output=user_output)
        contents = [types.Content(role="user", parts=[types.Part(text=prompt)])]
        return await self._generate(contents=contents, include_image=False)

    async def judge_image(
        self,
        prompt_input: str,
        image_bytes: bytes,
        image_mime_type: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        del progress_callback
        prompt = build_image_judgment_prompt(topic=prompt_input)
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part(
                        inline_data=types.Blob(mime_type=image_mime_type, data=image_bytes),
                    ),
                    types.Part(text=prompt),
                ],
            )
        ]
        return await self._generate(contents=contents, include_image=True)

    async def _generate(
        self,
        *,
        contents: list[types.Content],
        include_image: bool,
    ) -> JudgmentResult:
        config = self._build_generate_config(include_image=include_image)
        try:
            # google-genai の async client は内部で aiohttp を使うが、判定 1 件ごとに
            # client を使い回せる。タイムアウトは http_options ではなく asyncio.wait_for で囲む。
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config=config,
                ),
                timeout=self.timeout_seconds,
            )
        except TimeoutError as exc:
            raise VertexProviderError(
                f"Vertex AI 呼び出しが {self.timeout_seconds}s でタイムアウトしました。"
            ) from exc
        except Exception as exc:
            raise VertexProviderError(f"Vertex AI 呼び出しに失敗しました: {exc}") from exc

        text = (response.text or "").strip()
        if text == "":
            raise VertexProviderError("Vertex AI レスポンスに本文テキストがありません。")
        try:
            return JudgmentResult.model_validate_json(_strip_code_fence(text))
        except (json.JSONDecodeError, ValidationError) as exc:
            raise VertexProviderError(
                "Vertex AI のレスポンスを JudgmentResult として解釈できませんでした。"
            ) from exc

    def _build_generate_config(self, *, include_image: bool) -> types.GenerateContentConfig:
        config_kwargs: dict[str, Any] = {
            "temperature": self.temperature,
            "response_mime_type": "application/json",
            "response_json_schema": judgment_response_json_schema(),
        }
        if self.thinking_budget is not None:
            config_kwargs["thinking_config"] = types.ThinkingConfig(
                thinking_budget=self.thinking_budget,
            )
        if include_image:
            config_kwargs["media_resolution"] = self.image_media_resolution
        return types.GenerateContentConfig(**config_kwargs)


def _normalize_media_resolution(value: str) -> types.MediaResolution:
    normalized = value.strip().lower()
    if normalized not in _MEDIA_RESOLUTION_MAP:
        raise ValueError(f"unsupported Vertex AI media resolution: {value}")
    return _MEDIA_RESOLUTION_MAP[normalized]


def _strip_code_fence(text: str) -> str:
    """LLM が ```json ... ``` で囲んで返したケースのフォールバック。"""
    if not text.startswith("```"):
        return text
    lines = text.splitlines()
    if len(lines) < 3 or not lines[-1].startswith("```"):
        return text
    return "\n".join(lines[1:-1]).strip()

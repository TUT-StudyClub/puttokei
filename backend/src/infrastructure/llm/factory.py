"""LLM プロバイダーのファクトリ。"""

from __future__ import annotations

from typing import Literal

from src.config import LLMSettings
from src.domain.services.llm_judge_service import BaseLLMProvider
from src.infrastructure.llm.base import LLMAuthenticationError
from src.infrastructure.llm.gemini_provider import GeminiProvider

ProviderName = Literal["gemini"]


def create_llm_provider(settings: LLMSettings) -> BaseLLMProvider:
    """設定に応じて LLM プロバイダーを組み立てる。"""

    match settings.provider:
        case "gemini":
            if not settings.gemini_api_key:
                raise LLMAuthenticationError(
                    "LLM_GEMINI_API_KEY is not set. "
                    "Configure it before creating the Gemini provider."
                )
            return GeminiProvider(
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
                thinking_level=settings.gemini_thinking_level,
                temperature=settings.gemini_temperature,
                timeout_seconds=settings.timeout_seconds,
            )
        case _:
            raise ValueError(f"Unknown LLM provider: {settings.provider}")

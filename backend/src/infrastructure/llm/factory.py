"""LLM プロバイダーのファクトリ。"""

from src.config import Settings
from src.domain.services.llm_judge_service import LLMJudgeService
from src.infrastructure.llm.gemini_provider import GeminiProvider
from src.infrastructure.llm.local_judge_service import LocalJudgeService


def build_llm_judge_service(settings: Settings) -> LLMJudgeService:
    """Settings に応じた LLMJudgeService 実装を返す。"""
    if settings.llm_provider == "local":
        return LocalJudgeService()

    if settings.llm_provider == "gemini":
        api_key = settings.llm_gemini_api_key
        if not api_key:
            raise ValueError("LLM_PROVIDER=gemini の場合は LLM_GEMINI_API_KEY が必要です。")
        return GeminiProvider(
            api_key=api_key,
            model=settings.llm_gemini_model,
            temperature=settings.llm_gemini_temperature,
            timeout_seconds=settings.llm_timeout_seconds,
            thinking_level=settings.llm_gemini_thinking_level,
            image_media_resolution=settings.llm_gemini_image_media_resolution,
        )

    raise ValueError(f"unsupported llm provider: {settings.llm_provider}")

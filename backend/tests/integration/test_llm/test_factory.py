"""LLM provider factory のテスト。"""

from typing import Any, cast

import pytest

from src.config import LLMSettings
from src.infrastructure.llm.errors import LLMAuthenticationError
from src.infrastructure.llm.factory import create_llm_provider
from src.infrastructure.llm.gemini_provider import GeminiProvider


def _load_llm_settings(*, gemini_api_key: str = "") -> LLMSettings:
    settings_type = cast(Any, LLMSettings)
    return cast(LLMSettings, settings_type(_env_file=None, gemini_api_key=gemini_api_key))


def test_factory_returns_gemini_provider(mock_gemini_client: dict[str, Any]) -> None:
    settings = _load_llm_settings(
        gemini_api_key="test-key",
    )

    provider = create_llm_provider(settings)

    assert isinstance(provider, GeminiProvider)


def test_factory_raises_when_gemini_api_key_is_missing() -> None:
    settings = _load_llm_settings()

    with pytest.raises(LLMAuthenticationError, match="LLM_GEMINI_API_KEY"):
        create_llm_provider(settings)


def test_factory_rejects_unknown_provider() -> None:
    settings = LLMSettings.model_construct(
        provider="unknown",
        gemini_api_key="test-key",
        gemini_model="gemini-3-flash-preview",
        gemini_thinking_level="MEDIUM",
        gemini_temperature=0.2,
        timeout_seconds=30,
    )

    with pytest.raises(ValueError, match="Unknown LLM provider"):
        create_llm_provider(settings)

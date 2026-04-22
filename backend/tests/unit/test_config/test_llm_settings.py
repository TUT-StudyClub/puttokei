"""LLMSettings の単体テスト。"""

from typing import Any, cast

import pytest
from pydantic import ValidationError

from src.config import LLMSettings


def _load_llm_settings() -> LLMSettings:
    settings_type = cast(Any, LLMSettings)
    return cast(LLMSettings, settings_type(_env_file=None))


@pytest.fixture(autouse=True)
def set_default_gemini_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-api-key")


def test_llm_settings_reads_gemini_api_key_from_environment(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-api-key")

    settings = _load_llm_settings()

    assert settings.gemini_api_key == "test-api-key"


def test_llm_settings_reads_thinking_level(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LLM_GEMINI_THINKING_LEVEL", "HIGH")

    settings = _load_llm_settings()

    assert settings.gemini_thinking_level == "HIGH"


def test_llm_settings_rejects_invalid_thinking_level(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LLM_GEMINI_THINKING_LEVEL", "INVALID")

    with pytest.raises(ValidationError):
        _load_llm_settings()


def test_llm_settings_rejects_out_of_range_temperature(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LLM_GEMINI_TEMPERATURE", "3.0")

    with pytest.raises(ValidationError):
        _load_llm_settings()


def test_llm_settings_has_expected_defaults():
    settings = _load_llm_settings()

    assert settings.provider == "gemini"
    assert settings.gemini_model == "gemini-3-flash-preview"
    assert settings.gemini_thinking_level == "MEDIUM"
    assert settings.gemini_temperature == 0.2
    assert settings.timeout_seconds == 30


def test_llm_settings_ignores_unknown_environment_variables(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("LLM_UNKNOWN_SETTING", "ignored")

    settings = _load_llm_settings()

    assert settings.model_dump().get("unknown_setting") is None


def test_llm_settings_requires_gemini_api_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("LLM_GEMINI_API_KEY", raising=False)

    with pytest.raises(ValidationError, match="gemini_api_key"):
        _load_llm_settings()

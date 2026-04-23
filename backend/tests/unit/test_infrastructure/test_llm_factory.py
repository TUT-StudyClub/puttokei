import pytest

from src.config import Settings
from src.infrastructure.llm.factory import build_llm_judge_service
from src.infrastructure.llm.gemini_provider import GeminiProvider
from src.infrastructure.llm.local_judge_service import LocalJudgeService


def test_build_llm_judge_service_returns_local_service_for_local_provider():
    settings = Settings(llm_provider="local")

    service = build_llm_judge_service(settings)

    assert isinstance(service, LocalJudgeService)


def test_build_llm_judge_service_returns_gemini_provider_for_gemini_provider():
    settings = Settings(
        llm_provider="gemini",
        llm_gemini_api_key="test-api-key",
        llm_gemini_model="gemini-3-flash-preview",
        llm_gemini_temperature=0.2,
        llm_timeout_seconds=30,
        llm_gemini_thinking_level="MEDIUM",
    )

    service = build_llm_judge_service(settings)

    assert isinstance(service, GeminiProvider)


def test_build_llm_judge_service_requires_api_key_for_gemini_provider():
    settings = Settings.model_construct(
        app_env="development",
        database_url="postgresql+asyncpg://test:test@127.0.0.1:1/hourglass_test",
        firebase_project_id="hourglass-test",
        firebase_credentials_path=None,
        dev_mock_auth_enabled=False,
        local_judgment_enabled=False,
        llm_provider="gemini",
        llm_gemini_api_key=None,
        llm_gemini_model="gemini-3-flash-preview",
        llm_gemini_thinking_level=None,
        llm_gemini_temperature=0.2,
        llm_timeout_seconds=30,
        log_level="INFO",
    )

    with pytest.raises(ValueError, match="LLM_GEMINI_API_KEY"):
        build_llm_judge_service(settings)

"""Container 経由の LLM provider 取得テスト。"""

from __future__ import annotations

import importlib
import sys
from typing import Any

import pytest

from src.container import Container, get_llm_provider
from src.domain.services.llm_judge_service import BaseLLMProvider
from src.infrastructure.llm.errors import LLMAuthenticationError
from src.infrastructure.llm.gemini_provider import GeminiProvider


def test_get_llm_provider_returns_provider(
    monkeypatch: pytest.MonkeyPatch,
    mock_gemini_client: dict[str, Any],
) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-key")

    provider = get_llm_provider()

    assert isinstance(provider, BaseLLMProvider)
    assert isinstance(provider, GeminiProvider)


def test_get_llm_provider_is_singleton(
    monkeypatch: pytest.MonkeyPatch,
    mock_gemini_client: dict[str, Any],
) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-key")

    first = get_llm_provider()
    second = get_llm_provider()

    assert first is second


def test_get_llm_provider_raises_when_gemini_api_key_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _FakeLLMSettings:
        gemini_api_key = ""
        gemini_model = "gemini-3-flash-preview"
        gemini_thinking_level = "MEDIUM"
        gemini_temperature = 0.2
        timeout_seconds = 30

    monkeypatch.setattr("src.config.LLMSettings", _FakeLLMSettings)

    with pytest.raises(LLMAuthenticationError, match="LLM_GEMINI_API_KEY"):
        get_llm_provider()


def test_existing_container_exposes_same_llm_provider_instance(
    monkeypatch: pytest.MonkeyPatch,
    mock_gemini_client: dict[str, Any],
    container: Container,
) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-key")

    provider_from_container = container.llm_provider
    provider_from_helper = get_llm_provider()

    assert provider_from_container is provider_from_helper


def test_src_container_import_is_lazy_for_llm_modules() -> None:
    module_names = [
        "src.container",
        "src.infrastructure.llm",
        "src.infrastructure.llm.errors",
        "src.infrastructure.llm.errors.exceptions",
        "src.infrastructure.llm.errors.http",
        "src.infrastructure.llm.gemini_provider",
    ]
    original_modules = {module_name: sys.modules.get(module_name) for module_name in module_names}

    for module_name in module_names:
        sys.modules.pop(module_name, None)

    try:
        importlib.import_module("src.container")

        assert "src.infrastructure.llm.gemini_provider" not in sys.modules
    finally:
        for module_name, module in original_modules.items():
            if module is not None:
                sys.modules[module_name] = module


def test_existing_container_other_dependencies_still_work(
    monkeypatch: pytest.MonkeyPatch,
    mock_gemini_client: dict[str, Any],
    container: Container,
) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-key")

    assert container.database is not None
    assert container.user_repository is not None
    assert container.llm_provider.__class__.__name__ == "GeminiProvider"

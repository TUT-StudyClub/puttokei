"""LLMContainer と既存 Container の共存テスト。"""

from __future__ import annotations

import importlib
import sys
from typing import Any

import pytest

from src.container import Container
from src.domain.services.llm_judge_service import BaseLLMProvider
from src.infrastructure.llm.container import LLMContainer, get_llm_provider
from src.infrastructure.llm.gemini_provider import GeminiProvider


def test_llm_container_returns_provider(
    monkeypatch: pytest.MonkeyPatch,
    mock_gemini_client: dict[str, Any],
) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-key")

    llm_container = LLMContainer()
    provider = llm_container.provider()

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
    for module_name in [
        "src.container",
        "src.infrastructure.llm",
        "src.infrastructure.llm.container",
        "src.infrastructure.llm.errors",
        "src.infrastructure.llm.errors.exceptions",
        "src.infrastructure.llm.errors.http",
        "src.infrastructure.llm.factory",
        "src.infrastructure.llm.gemini_provider",
    ]:
        sys.modules.pop(module_name, None)

    importlib.import_module("src.container")

    assert "src.infrastructure.llm.container" not in sys.modules
    assert "src.infrastructure.llm.factory" not in sys.modules
    assert "src.infrastructure.llm.gemini_provider" not in sys.modules


def test_existing_container_other_dependencies_still_work(
    monkeypatch: pytest.MonkeyPatch,
    mock_gemini_client: dict[str, Any],
    container: Container,
) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-key")

    assert container.database is not None
    assert container.user_repository is not None
    assert container.llm_provider.__class__.__name__ == "GeminiProvider"

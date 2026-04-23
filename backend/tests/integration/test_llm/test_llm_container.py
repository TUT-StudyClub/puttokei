"""Container 経由の LLM provider 取得テスト。"""

from __future__ import annotations

import importlib
import sys
from collections.abc import Iterator
from typing import Any, cast

import pytest
from pydantic import ValidationError
from pytest_mock import MockerFixture

from src.config import LLMSettings
from src.container import Container, get_llm_provider
from src.domain.services.llm_judge_service import LLMProvider
from src.infrastructure.llm.gemini_provider import GeminiProvider


@pytest.fixture(autouse=True)
def reset_llm_provider_cache() -> Iterator[None]:
    get_llm_provider.cache_clear()
    yield
    get_llm_provider.cache_clear()


@pytest.fixture
def patch_gemini_client(mocker: MockerFixture) -> None:
    mocker.patch("src.infrastructure.llm.gemini_provider.Client")


def test_get_llm_provider_returns_provider(
    monkeypatch: pytest.MonkeyPatch,
    patch_gemini_client: None,
) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-key")

    provider = get_llm_provider()

    assert isinstance(provider, LLMProvider)
    assert isinstance(provider, GeminiProvider)


def test_get_llm_provider_is_singleton(
    monkeypatch: pytest.MonkeyPatch,
    patch_gemini_client: None,
) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-key")

    first = get_llm_provider()
    second = get_llm_provider()

    assert first is second


def test_get_llm_provider_raises_when_gemini_api_key_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings_type = cast(Any, LLMSettings)

    monkeypatch.delenv("LLM_GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(
        "src.config.LLMSettings",
        lambda: cast(LLMSettings, settings_type(_env_file=None)),
    )

    with pytest.raises(ValidationError, match="gemini_api_key"):
        get_llm_provider()


def test_src_container_import_is_lazy_for_llm_modules() -> None:
    module_names = [
        "src.container",
        "src.infrastructure.llm",
        "src.infrastructure.llm.errors",
        "src.infrastructure.llm.errors.exceptions",
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
    patch_gemini_client: None,
    container: Container,
) -> None:
    monkeypatch.setenv("LLM_GEMINI_API_KEY", "test-key")

    assert container.database is not None
    assert container.authenticate_user is not None
    assert get_llm_provider().__class__.__name__ == "GeminiProvider"

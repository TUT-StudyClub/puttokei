"""LLM プロバイダー専用の DI コンテナ。"""

from __future__ import annotations

from dependency_injector import containers, providers

from src.config import LLMSettings
from src.domain.services.llm_judge_service import BaseLLMProvider
from src.infrastructure.llm.factory import create_llm_provider


class LLMContainer(containers.DeclarativeContainer):
    """LLM プロバイダー専用の dependency-injector コンテナ。"""

    settings = providers.Singleton(LLMSettings)
    provider = providers.Singleton(create_llm_provider, settings=settings)


_container: LLMContainer | None = None


def get_llm_provider() -> BaseLLMProvider:
    """既存 Container から呼び出す LLM provider 取得ヘルパー。"""

    global _container
    container = _container
    if container is None:
        container = LLMContainer()
        _container = container
    return container.provider()

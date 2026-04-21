"""LLM integration test 用 fixture。"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from src.domain.services.llm_judge_service import LLMJudgmentInput
from src.infrastructure.llm import container as llm_container_module


@pytest.fixture(autouse=True)
def reset_llm_container_singleton():
    llm_container_module._container = None
    yield
    llm_container_module._container = None


@pytest.fixture
def sample_llm_input() -> LLMJudgmentInput:
    return LLMJudgmentInput(
        subject="理科",
        topic="光合成",
        content=(
            "光合成は植物が光エネルギーを使って二酸化炭素と水から"
            "デンプンなどの有機物を作り、酸素を放出するはたらきです。"
        ),
        age_group="10s",
        prompt_version="v1",
    )


@pytest.fixture
def sample_gemini_payload() -> dict[str, object]:
    return {
        "verdict": "partial",
        "score": 78,
        "items": [
            {
                "claim": "光合成は二酸化炭素と水を使う",
                "correct": True,
                "feedback": "主な材料を正しく捉えています。",
            },
            {
                "claim": "生成物はデンプンと酸素",
                "correct": True,
                "feedback": "生成物の理解も概ね正しいです。",
            },
        ],
        "advice": "葉緑体や光の役割も補足できるとより良いです。",
    }


@pytest.fixture
def build_gemini_response():
    def _build(
        payload: dict[str, object] | None = None,
        *,
        prompt_tokens: int = 11,
        completion_tokens: int = 7,
    ) -> SimpleNamespace:
        return SimpleNamespace(
            text=json.dumps(payload or {}),
            usage_metadata=SimpleNamespace(
                prompt_token_count=prompt_tokens,
                candidates_token_count=completion_tokens,
            ),
        )

    return _build


@pytest.fixture
def mock_gemini_client(mocker: MockerFixture) -> dict[str, Any]:
    mock_generate_content = AsyncMock()
    mock_client = mocker.MagicMock()
    mock_client.aio = mocker.MagicMock()
    mock_client.aio.models = mocker.MagicMock()
    mock_client.aio.models.generate_content = mock_generate_content
    mocker.patch(
        "src.infrastructure.llm.gemini_provider.Client",
        return_value=mock_client,
    )
    return {
        "client": mock_client,
        "generate_content": mock_generate_content,
    }

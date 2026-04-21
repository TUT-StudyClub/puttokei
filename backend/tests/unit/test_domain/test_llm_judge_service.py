"""LLM 判定ドメインサービスの契約テスト。"""

from dataclasses import FrozenInstanceError
from typing import Any, cast

import pytest

from src.domain.services.llm_judge_service import (
    BaseLLMProvider,
    LLMJudgmentInput,
    LLMJudgmentItem,
    LLMJudgmentOutput,
    TokenUsage,
)


def test_base_llm_provider_is_abstract():
    with pytest.raises(TypeError):
        BaseLLMProvider()


def test_llm_judgment_input_is_frozen_dataclass():
    input_data = LLMJudgmentInput(
        subject="数学",
        topic="極限",
        content="極限は近づく値です。",
        age_group="20s",
        prompt_version="v1",
    )

    with pytest.raises(FrozenInstanceError):
        input_data.subject = "英語"  # type: ignore[misc]


def test_llm_judgment_output_is_frozen_dataclass():
    output = LLMJudgmentOutput(
        verdict="correct",
        score=90,
        items=[LLMJudgmentItem(claim="極限は値に近づく概念", correct=True, feedback="良いです")],
        advice="定義も書けるとより良いです。",
        provider_name="gemini",
        model_name="gemini-3-flash-preview",
        latency_ms=123,
        token_usage=TokenUsage(prompt_tokens=10, completion_tokens=5),
    )

    with pytest.raises(FrozenInstanceError):
        output.score = 80  # type: ignore[misc]


def test_llm_judgment_item_is_frozen_dataclass():
    item = LLMJudgmentItem(claim="主張", correct=True, feedback="補足")

    with pytest.raises(FrozenInstanceError):
        item.feedback = "書き換え"  # type: ignore[misc]


def test_token_usage_is_frozen_dataclass():
    usage = TokenUsage(prompt_tokens=10, completion_tokens=5)

    with pytest.raises(FrozenInstanceError):
        usage.prompt_tokens = 3  # type: ignore[misc]


@pytest.mark.parametrize("invalid_score", [-1, 101])
def test_llm_judgment_output_rejects_out_of_range_score(invalid_score: int):
    with pytest.raises(ValueError, match="score"):
        LLMJudgmentOutput(
            verdict="correct",
            score=invalid_score,
            items=[],
            advice="advice",
            provider_name="gemini",
            model_name="gemini-3-flash-preview",
            latency_ms=1,
            token_usage=None,
        )


def test_llm_judgment_output_rejects_unknown_verdict():
    with pytest.raises(ValueError, match="Unsupported verdict"):
        LLMJudgmentOutput(
            verdict=cast(Any, "unknown"),
            score=50,
            items=[],
            advice="advice",
            provider_name="gemini",
            model_name="gemini-3-flash-preview",
            latency_ms=1,
            token_usage=None,
        )

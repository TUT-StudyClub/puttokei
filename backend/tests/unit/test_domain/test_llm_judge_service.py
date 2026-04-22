"""LLM 判定ドメインサービスの契約テスト。"""

from typing import Any, cast

import pytest
from pydantic import ValidationError

from src.domain.services.llm_judge_service import (
    LLMJudgmentInput,
    LLMJudgmentItem,
    LLMJudgmentOutput,
    LLMProvider,
    TokenUsage,
)


def test_llm_provider_is_abstract():
    with pytest.raises(TypeError):
        LLMProvider()


def test_llm_judgment_input_is_frozen_model():
    input_data = LLMJudgmentInput(
        subject="数学",
        topic="極限",
        content="極限は近づく値です。",
        age_group="20s",
    )

    with pytest.raises(ValidationError, match="Instance is frozen"):
        input_data.subject = "英語"  # type: ignore[misc]


def test_llm_judgment_output_is_frozen_model():
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

    with pytest.raises(ValidationError, match="Instance is frozen"):
        output.score = 80  # type: ignore[misc]


def test_llm_judgment_item_is_frozen_model():
    item = LLMJudgmentItem(claim="主張", correct=True, feedback="補足")

    with pytest.raises(ValidationError, match="Instance is frozen"):
        item.feedback = "書き換え"  # type: ignore[misc]


def test_token_usage_is_frozen_model():
    usage = TokenUsage(prompt_tokens=10, completion_tokens=5)

    with pytest.raises(ValidationError, match="Instance is frozen"):
        usage.prompt_tokens = 3  # type: ignore[misc]


@pytest.mark.parametrize("invalid_score", [-1, 101])
def test_llm_judgment_output_rejects_out_of_range_score(invalid_score: int):
    with pytest.raises(ValidationError, match="score"):
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
    with pytest.raises(ValidationError, match="verdict"):
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


@pytest.mark.parametrize("field_name", ["provider_name", "model_name"])
def test_llm_judgment_output_rejects_empty_required_strings(field_name: str):
    if field_name == "provider_name":
        provider_name = ""
        model_name = "gemini-3-flash-preview"
    else:
        provider_name = "gemini"
        model_name = ""

    with pytest.raises(ValidationError, match=field_name):
        LLMJudgmentOutput(
            verdict="correct",
            score=50,
            items=[],
            advice="advice",
            provider_name=provider_name,
            model_name=model_name,
            latency_ms=1,
            token_usage=None,
        )

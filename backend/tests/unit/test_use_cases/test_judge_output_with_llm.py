"""JudgeOutputWithLLM のユニットテスト。"""

import pytest

from src.application.dto.judgment_dto import (
    JudgeOutputWithLLMCommand,
    JudgeOutputWithLLMItemView,
    JudgeOutputWithLLMTokenUsageView,
    JudgeOutputWithLLMView,
)
from src.application.use_cases.judge_output_with_llm import JudgeOutputWithLLM
from src.domain.services.llm_judge_service import (
    LLMJudgmentInput,
    LLMJudgmentItem,
    LLMJudgmentOutput,
    TokenUsage,
)
from tests.fakes.fake_llm_provider import FakeLLMProvider


@pytest.mark.asyncio
async def test_execute_converts_command_to_domain_and_returns_view():
    provider = FakeLLMProvider(
        output=LLMJudgmentOutput(
            verdict="partial",
            score=78,
            items=[LLMJudgmentItem(claim="説明がある", correct=True, feedback="よく書けています")],
            advice="具体例も足すとさらに良いです。",
            provider_name="gemini",
            model_name="gemini-test",
            latency_ms=123,
            token_usage=TokenUsage(prompt_tokens=21, completion_tokens=13),
        )
    )
    use_case = JudgeOutputWithLLM(llm_provider=provider)
    command = JudgeOutputWithLLMCommand(
        subject="理科",
        topic="光合成",
        content="植物が光を使って栄養を作る働きです。",
        age_group="10s",
        prompt_version="v1",
    )

    result = await use_case.execute(command)

    assert provider.calls == [
        LLMJudgmentInput(
            subject="理科",
            topic="光合成",
            content="植物が光を使って栄養を作る働きです。",
            age_group="10s",
            prompt_version="v1",
        )
    ]
    assert result == JudgeOutputWithLLMView(
        verdict="partial",
        score=78,
        items=[
            JudgeOutputWithLLMItemView(
                claim="説明がある",
                correct=True,
                feedback="よく書けています",
            )
        ],
        advice="具体例も足すとさらに良いです。",
        provider_name="gemini",
        model_name="gemini-test",
        latency_ms=123,
        token_usage=JudgeOutputWithLLMTokenUsageView(
            prompt_tokens=21,
            completion_tokens=13,
        ),
    )


@pytest.mark.asyncio
async def test_execute_returns_none_token_usage_as_is():
    provider = FakeLLMProvider(
        output=LLMJudgmentOutput(
            verdict="correct",
            score=90,
            items=[],
            advice="十分です。",
            provider_name="gemini",
            model_name="gemini-test",
            latency_ms=10,
            token_usage=None,
        )
    )
    use_case = JudgeOutputWithLLM(llm_provider=provider)

    result = await use_case.execute(
        JudgeOutputWithLLMCommand(
            subject="数学",
            topic="極限",
            content="極限はある値に近づく考え方です。",
            age_group=None,
            prompt_version="v1",
        )
    )

    assert result.token_usage is None

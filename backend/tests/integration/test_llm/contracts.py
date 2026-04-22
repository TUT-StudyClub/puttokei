"""LLMProvider 実装が満たすべき契約テスト。"""

import pytest

from src.domain.services.llm_judge_service import (
    LLMJudgmentInput,
    LLMJudgmentOutput,
    LLMProvider,
)

SAMPLE_LLM_INPUT = LLMJudgmentInput(
    subject="理科",
    topic="光合成",
    content=(
        "光合成は植物が光エネルギーを使って二酸化炭素と水から"
        "デンプンなどの有機物を作り、酸素を放出するはたらきです。"
    ),
    age_group="10s",
    prompt_version="v1",
)


class LLMProviderContract:
    """すべての LLM プロバイダー実装で共通に満たすべき契約。"""

    @pytest.mark.asyncio
    async def test_judge_returns_valid_output(
        self,
        provider: LLMProvider,
    ) -> None:
        output = await provider.judge(SAMPLE_LLM_INPUT)

        assert isinstance(output, LLMJudgmentOutput)
        assert output.verdict in {"correct", "partial", "incorrect", "rejected"}
        assert 0 <= output.score <= 100
        assert output.provider_name != ""
        assert output.model_name != ""
        assert output.latency_ms >= 0
        assert isinstance(output.items, list)
        assert isinstance(output.advice, str)

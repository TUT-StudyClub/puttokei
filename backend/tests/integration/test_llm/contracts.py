"""BaseLLMProvider 実装が満たすべき契約テスト。"""

import pytest

from src.domain.services.llm_judge_service import (
    BaseLLMProvider,
    LLMJudgmentInput,
    LLMJudgmentOutput,
)


class BaseLLMProviderContract:
    """すべての LLM プロバイダー実装で共通に満たすべき契約。"""

    @pytest.mark.asyncio
    async def test_judge_returns_valid_output(
        self,
        provider: BaseLLMProvider,
        sample_llm_input: LLMJudgmentInput,
    ) -> None:
        output = await provider.judge(sample_llm_input)

        assert isinstance(output, LLMJudgmentOutput)
        assert output.verdict in {"correct", "partial", "incorrect", "rejected"}
        assert 0 <= output.score <= 100
        assert output.provider_name != ""
        assert output.model_name != ""
        assert output.latency_ms >= 0
        assert isinstance(output.items, list)
        assert isinstance(output.advice, str)

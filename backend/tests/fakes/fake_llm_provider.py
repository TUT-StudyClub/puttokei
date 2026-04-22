"""テスト用の LLM provider fake。"""

from src.domain.services.llm_judge_service import (
    LLMJudgmentInput,
    LLMJudgmentOutput,
    LLMProvider,
)


class FakeLLMProvider(LLMProvider):
    """固定の判定結果を返す fake。"""

    def __init__(self, output: LLMJudgmentOutput) -> None:
        self.output = output

    async def judge(self, _input_data: LLMJudgmentInput) -> LLMJudgmentOutput:
        return self.output

"""テスト用の LLM provider fake。"""

from src.domain.services.llm_judge_service import (
    BaseLLMProvider,
    LLMJudgmentInput,
    LLMJudgmentOutput,
)


class FakeLLMProvider(BaseLLMProvider):
    """固定の判定結果を返し、呼び出し履歴を保持する fake。"""

    def __init__(self, output: LLMJudgmentOutput) -> None:
        self.output = output
        self.calls: list[LLMJudgmentInput] = []

    async def judge(self, input_data: LLMJudgmentInput) -> LLMJudgmentOutput:
        self.calls.append(input_data)
        return self.output

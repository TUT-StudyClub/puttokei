"""LLM を使って学習アウトプットを判定するユースケース。"""

from src.application.dto.judgment_dto import (
    JudgeOutputWithLLMCommand,
    JudgeOutputWithLLMView,
)
from src.application.mappers.judge_output_with_llm_mapper import to_domain_input, to_view
from src.domain.services.llm_judge_service import BaseLLMProvider


class JudgeOutputWithLLM:
    """LLM provider を呼び出し、判定結果を返す。"""

    def __init__(self, llm_provider: BaseLLMProvider) -> None:
        self._llm_provider = llm_provider

    async def execute(self, command: JudgeOutputWithLLMCommand) -> JudgeOutputWithLLMView:
        output = await self._llm_provider.judge(to_domain_input(command))
        return to_view(output)

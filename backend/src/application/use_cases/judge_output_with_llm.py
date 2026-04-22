"""LLM を使って学習アウトプットを判定するユースケース。"""

from src.application.dto.judgment_dto import (
    LLMJudgmentInputDTO,
    LLMJudgmentItemDTO,
    LLMJudgmentOutputDTO,
    TokenUsageDTO,
)
from src.domain.services.llm_judge_service import (
    BaseLLMProvider,
    LLMJudgmentInput,
    LLMJudgmentItem,
    LLMJudgmentOutput,
    TokenUsage,
)


class JudgeOutputWithLLM:
    """LLM provider を呼び出し、DTO を介して結果を返す。"""

    def __init__(self, llm_provider: BaseLLMProvider) -> None:
        self._llm_provider = llm_provider

    async def execute(self, input_dto: LLMJudgmentInputDTO) -> LLMJudgmentOutputDTO:
        output = await self._llm_provider.judge(_to_domain_input(input_dto))
        return _to_output_dto(output)


def _to_domain_input(input_dto: LLMJudgmentInputDTO) -> LLMJudgmentInput:
    return LLMJudgmentInput(
        subject=input_dto.subject,
        topic=input_dto.topic,
        content=input_dto.content,
        age_group=input_dto.age_group,
        prompt_version=input_dto.prompt_version,
    )


def _to_output_dto(output: LLMJudgmentOutput) -> LLMJudgmentOutputDTO:
    token_usage = output.token_usage
    return LLMJudgmentOutputDTO(
        verdict=output.verdict,
        score=output.score,
        items=[_to_item_dto(item) for item in output.items],
        advice=output.advice,
        provider_name=output.provider_name,
        model_name=output.model_name,
        latency_ms=output.latency_ms,
        token_usage=None if token_usage is None else _to_token_usage_dto(token_usage),
    )


def _to_item_dto(item: LLMJudgmentItem) -> LLMJudgmentItemDTO:
    return LLMJudgmentItemDTO(
        claim=item.claim,
        correct=item.correct,
        feedback=item.feedback,
    )


def _to_token_usage_dto(usage: TokenUsage) -> TokenUsageDTO:
    return TokenUsageDTO(
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
    )

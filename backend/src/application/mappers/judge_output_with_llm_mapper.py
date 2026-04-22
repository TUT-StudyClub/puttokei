"""JudgeOutputWithLLM の mapper。"""

from src.application.dto.judgment_dto import (
    JudgeOutputWithLLMCommand,
    JudgeOutputWithLLMItemView,
    JudgeOutputWithLLMTokenUsageView,
    JudgeOutputWithLLMView,
)
from src.domain.services.llm_judge_service import (
    LLMJudgmentInput,
    LLMJudgmentItem,
    LLMJudgmentOutput,
    TokenUsage,
)


class JudgeOutputWithLLMMapper:
    """JudgeOutputWithLLM で使う DTO / domain 変換をまとめる。"""

    @staticmethod
    def to_domain_input(command: JudgeOutputWithLLMCommand) -> LLMJudgmentInput:
        return LLMJudgmentInput(
            subject=command.subject,
            topic=command.topic,
            content=command.content,
            age_group=command.age_group,
            prompt_version=command.prompt_version,
        )

    @staticmethod
    def to_view(output: LLMJudgmentOutput) -> JudgeOutputWithLLMView:
        token_usage = output.token_usage
        return JudgeOutputWithLLMView(
            verdict=output.verdict,
            score=output.score,
            items=[JudgeOutputWithLLMMapper._to_item_view(item) for item in output.items],
            advice=output.advice,
            provider_name=output.provider_name,
            model_name=output.model_name,
            latency_ms=output.latency_ms,
            token_usage=(
                None
                if token_usage is None
                else JudgeOutputWithLLMMapper._to_token_usage_view(token_usage)
            ),
        )

    @staticmethod
    def _to_item_view(item: LLMJudgmentItem) -> JudgeOutputWithLLMItemView:
        return JudgeOutputWithLLMItemView(
            claim=item.claim,
            correct=item.correct,
            feedback=item.feedback,
        )

    @staticmethod
    def _to_token_usage_view(usage: TokenUsage) -> JudgeOutputWithLLMTokenUsageView:
        return JudgeOutputWithLLMTokenUsageView(
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
        )

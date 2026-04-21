"""判定関連ユースケースの入出力 DTO。"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.services.llm_judge_service import (
    LLMJudgmentInput,
    LLMJudgmentItem,
    LLMJudgmentOutput,
    TokenUsage,
)
from src.domain.value_objects.verdict import Verdict


class JudgmentItemView(FrozenModel):
    """判定結果の補足コメント。"""

    label: str
    comment: str


class JudgmentView(FrozenModel):
    """取得済み判定結果。"""

    id: UUID
    session_id: UUID
    verdict: Verdict
    score: int
    advice: str
    items: list[JudgmentItemView]
    judged_at: datetime


class JudgmentPendingView(FrozenModel):
    """判定がまだ未完了であることを表すビュー。"""

    status: Literal["pending"] = "pending"
    detail: str
    retry_after_seconds: int
    estimated_ready_at: datetime


class LLMJudgmentInputDTO(FrozenModel):
    """LLM 判定入力のアプリケーション DTO。"""

    subject: str
    topic: str
    content: str
    age_group: str | None
    prompt_version: str

    def to_domain(self) -> LLMJudgmentInput:
        return LLMJudgmentInput(
            subject=self.subject,
            topic=self.topic,
            content=self.content,
            age_group=self.age_group,
            prompt_version=self.prompt_version,
        )

    @classmethod
    def from_domain(cls, input_data: LLMJudgmentInput) -> "LLMJudgmentInputDTO":
        return cls(
            subject=input_data.subject,
            topic=input_data.topic,
            content=input_data.content,
            age_group=input_data.age_group,
            prompt_version=input_data.prompt_version,
        )


class LLMJudgmentItemDTO(FrozenModel):
    """LLM 判定項目のアプリケーション DTO。"""

    claim: str
    correct: bool
    feedback: str

    def to_domain(self) -> LLMJudgmentItem:
        return LLMJudgmentItem(
            claim=self.claim,
            correct=self.correct,
            feedback=self.feedback,
        )

    @classmethod
    def from_domain(cls, item: LLMJudgmentItem) -> "LLMJudgmentItemDTO":
        return cls(
            claim=item.claim,
            correct=item.correct,
            feedback=item.feedback,
        )


class TokenUsageDTO(FrozenModel):
    """トークン使用量のアプリケーション DTO。"""

    prompt_tokens: int
    completion_tokens: int

    def to_domain(self) -> TokenUsage:
        return TokenUsage(
            prompt_tokens=self.prompt_tokens,
            completion_tokens=self.completion_tokens,
        )

    @classmethod
    def from_domain(cls, usage: TokenUsage) -> "TokenUsageDTO":
        return cls(
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
        )


class LLMJudgmentOutputDTO(FrozenModel):
    """LLM 判定結果のアプリケーション DTO。"""

    verdict: Literal["correct", "partial", "incorrect", "rejected"]
    score: int
    items: list[LLMJudgmentItemDTO]
    advice: str
    provider_name: str
    model_name: str
    latency_ms: int
    token_usage: TokenUsageDTO | None = None

    def to_domain(self) -> LLMJudgmentOutput:
        return LLMJudgmentOutput(
            verdict=self.verdict,
            score=self.score,
            items=[item.to_domain() for item in self.items],
            advice=self.advice,
            provider_name=self.provider_name,
            model_name=self.model_name,
            latency_ms=self.latency_ms,
            token_usage=None if self.token_usage is None else self.token_usage.to_domain(),
        )

    @classmethod
    def from_domain(cls, output_data: LLMJudgmentOutput) -> "LLMJudgmentOutputDTO":
        token_usage = output_data.token_usage
        token_usage_dto = None if token_usage is None else TokenUsageDTO.from_domain(token_usage)
        return cls(
            verdict=output_data.verdict,
            score=output_data.score,
            items=[LLMJudgmentItemDTO.from_domain(item) for item in output_data.items],
            advice=output_data.advice,
            provider_name=output_data.provider_name,
            model_name=output_data.model_name,
            latency_ms=output_data.latency_ms,
            token_usage=token_usage_dto,
        )

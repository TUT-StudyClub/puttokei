"""Gemini structured output の schema と変換。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from src.domain.services.llm_judge_service import (
    LLMJudgmentItem,
    LLMJudgmentOutput,
    LLMVerdict,
    TokenUsage,
)


class GeminiJudgmentSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    verdict: LLMVerdict
    score: int = Field(ge=0, le=100)
    items: list[LLMJudgmentItem]
    advice: str

    @classmethod
    def response_json_schema(cls) -> dict[str, object]:
        return cls.model_json_schema()

    @classmethod
    def parse_response(cls, response: object) -> GeminiJudgmentSchema:
        return cls.model_validate_json(getattr(response, "text", "") or "")

    def to_domain_output(
        self,
        *,
        model_name: str,
        latency_ms: int,
        token_usage: TokenUsage | None,
    ) -> LLMJudgmentOutput:
        return LLMJudgmentOutput(
            verdict=self.verdict,
            score=self.score,
            items=self.items,
            advice=self.advice,
            provider_name="gemini",
            model_name=model_name,
            latency_ms=latency_ms,
            token_usage=token_usage,
        )

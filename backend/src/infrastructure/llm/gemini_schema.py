"""Gemini structured output の schema と変換。"""

from __future__ import annotations

import json

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from src.domain.services.llm_judge_service import (
    LLMJudgmentItem,
    LLMJudgmentOutput,
    LLMVerdict,
    TokenUsage,
)
from src.infrastructure.llm.errors import LLMResponseParseError


class GeminiSchemaModel(BaseModel):
    """Gemini structured output schema の共通基底。"""

    model_config = ConfigDict(extra="forbid")


class GeminiJudgmentItemSchema(GeminiSchemaModel):
    """Gemini から返る主張単位の判定 schema。"""

    claim: str
    correct: bool
    feedback: str


class GeminiJudgmentOutputSchema(GeminiSchemaModel):
    """Gemini から返る判定結果 schema。"""

    verdict: LLMVerdict
    score: int = Field(ge=0, le=100)
    items: list[GeminiJudgmentItemSchema]
    advice: str


def build_response_json_schema() -> dict[str, object]:
    """Gemini に渡す response_json_schema を返す。"""

    return GeminiJudgmentOutputSchema.model_json_schema()


def parse_response(response: object) -> GeminiJudgmentOutputSchema:
    """Gemini のレスポンスを structured output schema として読む。"""

    response_text = getattr(response, "text", None)
    if not response_text:
        raise LLMResponseParseError("Gemini returned an empty response.")

    try:
        payload = json.loads(response_text)
        return GeminiJudgmentOutputSchema.model_validate(payload)
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        raise LLMResponseParseError("Failed to parse Gemini structured output.") from exc


def to_domain_output(
    parsed: GeminiJudgmentOutputSchema,
    *,
    model_name: str,
    latency_ms: int,
    token_usage: TokenUsage | None,
) -> LLMJudgmentOutput:
    """Gemini schema を domain output に変換する。"""

    return LLMJudgmentOutput(
        verdict=parsed.verdict,
        score=parsed.score,
        items=[
            LLMJudgmentItem(
                claim=item.claim,
                correct=item.correct,
                feedback=item.feedback,
            )
            for item in parsed.items
        ],
        advice=parsed.advice,
        provider_name="gemini",
        model_name=model_name,
        latency_ms=latency_ms,
        token_usage=token_usage,
    )

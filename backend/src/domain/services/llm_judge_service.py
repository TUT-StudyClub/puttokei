"""LLM 判定サービスの抽象 IF と値オブジェクト。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal

from pydantic import Field, StrictBool, StrictInt, StrictStr

from src.common.models import FrozenModel

type LLMVerdict = Literal["correct", "partial", "incorrect", "rejected"]


class LLMJudgmentInput(FrozenModel):
    """LLM 判定に渡す入力。"""

    subject: StrictStr
    topic: StrictStr
    content: StrictStr
    age_group: StrictStr | None
    prompt_version: StrictStr = Field(min_length=1)


class LLMJudgmentItem(FrozenModel):
    """LLM が返した主張単位の判定結果。"""

    claim: StrictStr
    correct: StrictBool
    feedback: StrictStr


class TokenUsage(FrozenModel):
    """LLM 呼び出し時のトークン使用量。"""

    prompt_tokens: StrictInt = Field(ge=0)
    completion_tokens: StrictInt = Field(ge=0)


class LLMJudgmentOutput(FrozenModel):
    """LLM 判定の結果。"""

    verdict: LLMVerdict
    score: StrictInt = Field(ge=0, le=100)
    items: list[LLMJudgmentItem]
    advice: StrictStr
    provider_name: StrictStr = Field(min_length=1)
    model_name: StrictStr = Field(min_length=1)
    latency_ms: StrictInt = Field(ge=0)
    token_usage: TokenUsage | None


class BaseLLMProvider(ABC):
    """LLM プロバイダーの共通インターフェース。"""

    @abstractmethod
    async def judge(self, input_data: LLMJudgmentInput) -> LLMJudgmentOutput:
        """学習アウトプットを判定し、構造化された結果を返す。"""

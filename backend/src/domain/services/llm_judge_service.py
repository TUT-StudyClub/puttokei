"""LLM 判定サービスの抽象 IF と値オブジェクト。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

type LLMVerdict = Literal["correct", "partial", "incorrect", "rejected"]

_ALLOWED_VERDICTS: set[str] = {"correct", "partial", "incorrect", "rejected"}


@dataclass(frozen=True, slots=True)
class LLMJudgmentInput:
    """LLM 判定に渡す入力。"""

    subject: str
    topic: str
    content: str
    age_group: str | None
    prompt_version: str

    def __post_init__(self) -> None:
        if not self.prompt_version:
            raise ValueError("prompt_version must not be empty.")


@dataclass(frozen=True, slots=True)
class LLMJudgmentItem:
    """LLM が返した主張単位の判定結果。"""

    claim: str
    correct: bool
    feedback: str


@dataclass(frozen=True, slots=True)
class TokenUsage:
    """LLM 呼び出し時のトークン使用量。"""

    prompt_tokens: int
    completion_tokens: int

    def __post_init__(self) -> None:
        if self.prompt_tokens < 0:
            raise ValueError("prompt_tokens must be greater than or equal to 0.")
        if self.completion_tokens < 0:
            raise ValueError("completion_tokens must be greater than or equal to 0.")


@dataclass(frozen=True, slots=True)
class LLMJudgmentOutput:
    """LLM 判定の結果。"""

    verdict: LLMVerdict
    score: int
    items: list[LLMJudgmentItem]
    advice: str
    provider_name: str
    model_name: str
    latency_ms: int
    token_usage: TokenUsage | None

    def __post_init__(self) -> None:
        if self.verdict not in _ALLOWED_VERDICTS:
            raise ValueError(f"Unsupported verdict: {self.verdict}")
        if not 0 <= self.score <= 100:
            raise ValueError("score must be between 0 and 100.")
        if self.latency_ms < 0:
            raise ValueError("latency_ms must be greater than or equal to 0.")
        if not self.provider_name:
            raise ValueError("provider_name must not be empty.")
        if not self.model_name:
            raise ValueError("model_name must not be empty.")


class BaseLLMProvider(ABC):
    """LLM プロバイダーの共通インターフェース。"""

    @abstractmethod
    async def judge(self, input_data: LLMJudgmentInput) -> LLMJudgmentOutput:
        """学習アウトプットを判定し、構造化された結果を返す。"""


# 後方互換用の別名。今後は BaseLLMProvider を利用する。
LLMJudgeService = BaseLLMProvider

"""判定 API の Pydantic スキーマ。"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.verdict import Verdict


class JudgmentCorrectionResponse(FrozenModel):
    """アウトプット中の誤りに対する指摘。"""

    target_text: str
    correct_text: str
    explanation: str


class JudgmentResponse(FrozenModel):
    """判定結果レスポンス。"""

    id: UUID
    session_id: UUID
    verdict: Verdict
    score: int
    advice: str
    corrections: list[JudgmentCorrectionResponse]
    judged_at: datetime


class JudgmentPendingResponse(FrozenModel):
    """判定未完了レスポンス。"""

    status: Literal["pending"] = "pending"
    detail: str
    retry_after_seconds: int
    estimated_ready_at: datetime

"""判定 API の Pydantic スキーマ。"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.verdict import Verdict


class JudgmentItemResponse(FrozenModel):
    """判定結果の補足コメント。"""

    label: str
    comment: str


class JudgmentResponse(FrozenModel):
    """判定結果レスポンス。"""

    id: UUID
    session_id: UUID
    verdict: Verdict
    score: int
    advice: str
    items: list[JudgmentItemResponse]
    judged_at: datetime


class JudgmentPendingResponse(FrozenModel):
    """判定未完了レスポンス。"""

    status: Literal["pending"] = "pending"
    detail: str
    retry_after_seconds: int
    estimated_ready_at: datetime

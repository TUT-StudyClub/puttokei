"""判定関連ユースケースの入出力 DTO。"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from src.common.models import FrozenModel
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

"""判定関連ユースケースの入出力 DTO。"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.domain.value_objects.verdict import Verdict


class JudgmentCorrectionView(FrozenModel):
    """アウトプット中の誤りに対する指摘。"""

    target_text: str
    correct_text: str
    explanation: str


class JudgmentView(FrozenModel):
    """取得済み判定結果。"""

    id: UUID
    session_id: UUID
    verdict: Verdict
    score: int
    advice: str
    corrections: list[JudgmentCorrectionView]
    judged_at: datetime


class JudgmentPendingView(FrozenModel):
    """判定がまだ未完了であることを表すビュー。"""

    status: Literal["pending"] = "pending"
    detail: str
    retry_after_seconds: int
    estimated_ready_at: datetime


class JudgmentProgressView(FrozenModel):
    """判定進捗の現在値。"""

    session_id: UUID
    status: JudgmentProgressStatus
    stage: JudgmentProgressStage
    percent: int
    message: str
    event_seq: int
    updated_at: datetime
    completed_at: datetime | None
    error_code: str | None

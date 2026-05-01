"""LLM 判定進捗エンティティ。"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)


class JudgmentProgress(FrozenModel):
    """1 セッションに紐づく判定進捗。"""

    session_id: UUID
    status: JudgmentProgressStatus
    stage: JudgmentProgressStage
    percent: int
    message: str
    event_seq: int
    started_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    error_code: str | None

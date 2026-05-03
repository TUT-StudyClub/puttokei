"""判定 API の Pydantic スキーマ。"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.domain.value_objects.judgment_result import BoundingBox
from src.domain.value_objects.verdict import Verdict


class JudgmentCorrectionResponse(FrozenModel):
    """アウトプット中の誤りに対する指摘。

    `bbox` は画像判定で位置が特定できた correction にのみ入る。
    テキスト判定や bbox 未取得の画像 correction では None。
    """

    target_text: str
    correct_text: str
    explanation: str
    bbox: BoundingBox | None = None


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


class JudgmentProgressResponse(FrozenModel):
    """判定進捗レスポンス。"""

    status: JudgmentProgressStatus
    stage: JudgmentProgressStage
    percent: int
    message: str
    updated_at: datetime
    completed_at: datetime | None
    error_code: str | None

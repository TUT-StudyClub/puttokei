"""Judgment エンティティ。LLM 判定の結果。"""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from src.common.models import FrozenModel
from src.domain.value_objects.verdict import Verdict


class JudgmentItem(FrozenModel):
    """判定結果カードに表示する補足コメント。"""

    label: str
    comment: str


class Judgment(FrozenModel):
    """判定結果を表現するエンティティ。"""

    id: UUID
    session_id: UUID
    verdict: Verdict
    score: int = Field(ge=0, le=100)
    advice: str
    items: list[JudgmentItem]
    judged_at: datetime

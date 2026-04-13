"""Judgment エンティティ。LLM 判定の結果。"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.domain.value_objects.verdict import Verdict


class Judgment(BaseModel):
    """判定結果を表現するエンティティ。詳細スコアや項目別フィードバックは Epic #4 で追加する。"""

    model_config = ConfigDict(frozen=True)

    id: UUID
    session_id: UUID
    verdict: Verdict
    score: int = Field(ge=0, le=100)
    judged_at: datetime

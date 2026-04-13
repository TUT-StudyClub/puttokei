"""Session エンティティ。学習 1 サイクル（input/output/break/result）。

詳細フィールド（started_at の正確な型, ended_at, timer_settings 等）は
Epic #3 で追加する。
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from src.domain.value_objects.session_status import SessionStatus


class Session(BaseModel):
    """学習 1 サイクルを表現するエンティティ。"""

    model_config = ConfigDict(frozen=True)

    id: UUID
    user_id: UUID
    status: SessionStatus
    started_at: datetime

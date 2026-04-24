"""Output エンティティ。セッションごとに 1 件のアウトプット本文。"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel


class Output(FrozenModel):
    """送信されたアウトプット本文を表現するエンティティ。"""

    id: UUID
    session_id: UUID
    content: str
    submitted_at: datetime

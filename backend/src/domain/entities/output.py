"""Output エンティティ。セッションごとに 1 件のアウトプット本文。"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class Output(BaseModel):
    """送信されたアウトプット本文を表現するエンティティ。"""

    model_config = ConfigDict(frozen=True)

    id: UUID
    session_id: UUID
    content: str
    submitted_at: datetime

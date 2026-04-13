"""User エンティティ。Firebase UID と紐づく内部ユーザ。

詳細フィールド（display_name, email, deleted_at など）は Epic #2 で追加する。
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class User(BaseModel):
    """内部ユーザを表現するエンティティ。"""

    model_config = ConfigDict(frozen=True)

    id: UUID
    firebase_uid: str
    created_at: datetime

"""UserSettings エンティティ。要件書 4.3.2 の user_settings テーブル相当。

タイマー初期値と通知設定を保持する。新規ユーザ作成時に default 値で同時作成される。
"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel


class UserSettings(FrozenModel):
    """ユーザごとのタイマー / 通知設定。"""

    id: UUID
    user_id: UUID
    input_minutes: int = 20
    output_minutes: int = 5
    break_minutes: int = 5
    notification_enabled: bool = True
    created_at: datetime
    updated_at: datetime

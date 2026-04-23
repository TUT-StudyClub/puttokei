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

    def with_updates(
        self,
        *,
        input_minutes: int | None = None,
        output_minutes: int | None = None,
        break_minutes: int | None = None,
        notification_enabled: bool | None = None,
        updated_at: datetime,
    ) -> "UserSettings":
        """None 以外の項目だけを反映した新しい UserSettings を返す。"""
        optional_updates = {
            "input_minutes": input_minutes,
            "output_minutes": output_minutes,
            "break_minutes": break_minutes,
            "notification_enabled": notification_enabled,
        }
        update_fields: dict[str, object] = {
            "updated_at": updated_at,
            **{field: value for field, value in optional_updates.items() if value is not None},
        }
        return self.model_copy(update=update_fields)

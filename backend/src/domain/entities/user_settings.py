"""UserSettings エンティティ。要件書 4.3.2 の user_settings テーブル相当。

タイマー初期値と通知設定を保持する。新規ユーザ作成時に default 値で同時作成される。
"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel

MIN_TIMER_MINUTES = 1
MAX_TIMER_MINUTES = 120

DEFAULT_INPUT_MINUTES = 20
DEFAULT_OUTPUT_MINUTES = 5
DEFAULT_BREAK_MINUTES = 5
DEFAULT_NOTIFICATION_ENABLED = True


class UserSettings(FrozenModel):
    """ユーザごとのタイマー / 通知設定。"""

    id: UUID
    user_id: UUID
    input_minutes: int = DEFAULT_INPUT_MINUTES
    output_minutes: int = DEFAULT_OUTPUT_MINUTES
    break_minutes: int = DEFAULT_BREAK_MINUTES
    notification_enabled: bool = DEFAULT_NOTIFICATION_ENABLED
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

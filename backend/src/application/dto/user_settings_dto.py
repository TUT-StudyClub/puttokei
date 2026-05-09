"""UserSettings の DTO / コマンド。

CQRS 的な命名で役割を明示する:
- `UserSettingsView`: クライアントに返却する読み出し用ビュー
- `UpdateUserSettingsCommand`: 設定更新の意図を表す書き込み用コマンド
"""

from datetime import datetime

from pydantic import Field, StrictBool, StrictInt

from src.common.models import FrozenModel
from src.domain.entities.user_settings import MAX_TIMER_MINUTES, MIN_TIMER_MINUTES


class UserSettingsView(FrozenModel):
    """GET / PATCH /users/me/settings のレスポンス元になるビュー。"""

    input_minutes: int
    output_minutes: int
    break_minutes: int
    notification_enabled: bool
    updated_at: datetime


class UpdateUserSettingsCommand(FrozenModel):
    """PATCH /users/me/settings の入力コマンド。

    送られなかったフィールドは現在値を保持するため、ここでは省略可能（None）として表現する。
    """

    input_minutes: StrictInt | None = Field(
        default=None,
        ge=MIN_TIMER_MINUTES,
        le=MAX_TIMER_MINUTES,
    )
    output_minutes: StrictInt | None = Field(
        default=None,
        ge=MIN_TIMER_MINUTES,
        le=MAX_TIMER_MINUTES,
    )
    break_minutes: StrictInt | None = Field(
        default=None,
        ge=MIN_TIMER_MINUTES,
        le=MAX_TIMER_MINUTES,
    )
    notification_enabled: StrictBool | None = None

"""/api/v1/users/me/settings の Pydantic スキーマ。"""

from datetime import datetime

from pydantic import Field, StrictBool, StrictInt

from src.common.models import FrozenModel, StrictRequestModel
from src.domain.entities.user_settings import MAX_TIMER_MINUTES, MIN_TIMER_MINUTES


class UserSettingsResponse(FrozenModel):
    """GET /users/me/settings, PATCH /users/me/settings のレスポンス。"""

    input_minutes: int
    output_minutes: int
    break_minutes: int
    notification_enabled: bool
    updated_at: datetime


class UpdateUserSettingsRequest(StrictRequestModel):
    """PATCH /users/me/settings の body。

    すべてのフィールドが省略可能。minutes 系は 1 ～ 120 の厳密な整数を要求し、
    未知フィールドは StrictRequestModel により拒否する。「全フィールド未指定
    （空 body）」のチェックは、
    Pydantic の model_validator で投げると ValidationError の ctx に ValueError が入って
    Problem Details のシリアライズが失敗するため、ルーター層で明示的にハンドリングする。
    """

    input_minutes: StrictInt | None = Field(
        default=None,
        ge=MIN_TIMER_MINUTES,
        le=MAX_TIMER_MINUTES,
        description="インプット時間（分）。1〜120 の整数。",
        examples=[20],
    )
    output_minutes: StrictInt | None = Field(
        default=None,
        ge=MIN_TIMER_MINUTES,
        le=MAX_TIMER_MINUTES,
        description="アウトプット時間（分）。1〜120 の整数。",
        examples=[5],
    )
    break_minutes: StrictInt | None = Field(
        default=None,
        ge=MIN_TIMER_MINUTES,
        le=MAX_TIMER_MINUTES,
        description="休憩時間（分）。1〜120 の整数。",
        examples=[5],
    )
    notification_enabled: StrictBool | None = Field(
        default=None,
        description="プッシュ通知の有効 / 無効。",
        examples=[True],
    )

    def is_empty(self) -> bool:
        """すべてのフィールドが None かどうか。ルーター層で空 body を弾くために使う。"""
        return (
            self.input_minutes is None
            and self.output_minutes is None
            and self.break_minutes is None
            and self.notification_enabled is None
        )

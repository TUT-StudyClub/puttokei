"""/api/v1/users/me/settings の Pydantic スキーマ。"""

from datetime import datetime

from pydantic import Field

from src.common.models import FrozenModel, StrictRequestModel

# タイマー値の許容範囲。要件書 3.2.6 / 4.3.2 に明記された絶対値はないため、
# 1 分以上 180 分以下を「実用範囲」として採用する。境界値テストもこの値で行う。
_MINUTES_MIN = 1
_MINUTES_MAX = 180


class UserSettingsResponse(FrozenModel):
    """GET /users/me/settings, PATCH /users/me/settings のレスポンス。"""

    input_minutes: int
    output_minutes: int
    break_minutes: int
    notification_enabled: bool
    updated_at: datetime


class UpdateUserSettingsRequest(StrictRequestModel):
    """PATCH /users/me/settings の body。

    すべてのフィールドが省略可能。minutes 系は 1 ～ 180 の範囲を要求し、未知フィールドは
    StrictRequestModel により拒否する。「全フィールド未指定（空 body）」のチェックは、
    Pydantic の model_validator で投げると ValidationError の ctx に ValueError が入って
    Problem Details のシリアライズが失敗するため、ルーター層で明示的にハンドリングする。
    """

    input_minutes: int | None = Field(default=None, ge=_MINUTES_MIN, le=_MINUTES_MAX)
    output_minutes: int | None = Field(default=None, ge=_MINUTES_MIN, le=_MINUTES_MAX)
    break_minutes: int | None = Field(default=None, ge=_MINUTES_MIN, le=_MINUTES_MAX)
    notification_enabled: bool | None = None

    def is_empty(self) -> bool:
        """すべてのフィールドが None かどうか。ルーター層で空 body を弾くために使う。"""
        return (
            self.input_minutes is None
            and self.output_minutes is None
            and self.break_minutes is None
            and self.notification_enabled is None
        )

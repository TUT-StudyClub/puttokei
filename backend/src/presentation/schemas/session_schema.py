"""/api/v1/sessions 系の Pydantic スキーマ。"""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from src.common.models import FrozenModel, StrictRequestModel
from src.domain.value_objects.session_status import SessionStatus


class CreateSessionRequest(StrictRequestModel):
    """POST /sessions の body。

    要件書 4.3.3 の sessions テーブル定義に揃えてバリデーション範囲を決める。
    タイマーは 1〜120 分の整数を許可する。
    """

    subject: str = Field(min_length=1, max_length=50)
    topic: str = Field(min_length=1, max_length=200)
    input_minutes: int = Field(ge=1, le=120)
    output_minutes: int = Field(ge=1, le=120)
    break_minutes: int = Field(ge=1, le=120)


class SessionResponse(FrozenModel):
    """POST /sessions / GET /sessions/{id} のレスポンス。"""

    id: UUID
    user_id: UUID
    status: SessionStatus
    subject: str
    topic: str
    input_minutes: int
    output_minutes: int
    break_minutes: int
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime

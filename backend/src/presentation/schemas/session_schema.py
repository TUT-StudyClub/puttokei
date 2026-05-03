"""/api/v1/sessions 系の Pydantic スキーマ。"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints

from src.common.models import FrozenModel, StrictRequestModel
from src.domain.value_objects.output_kind import OutputKind
from src.domain.value_objects.session_status import SessionStatus
from src.presentation.schemas.judgment_schema import JudgmentResponse

NonEmptyOutputContent = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2000),
]

NonEmptyStoragePath = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=512),
]

OutputImageMimeType = Literal["image/jpeg", "image/png"]


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


class UpdateSessionRequest(StrictRequestModel):
    """PATCH /sessions/{id} の body。

    本 Task ではフェーズ遷移のための status 更新のみをサポートする。
    実際に許可される遷移は UseCase 側の遷移表で絞り込む。
    """

    status: SessionStatus


class SubmitTextOutputRequest(StrictRequestModel):
    """POST /sessions/{id}/outputs/text の body。"""

    content: NonEmptyOutputContent
    submitted_at: datetime


class SubmitImageOutputRequest(StrictRequestModel):
    """POST /sessions/{id}/outputs/image の body。"""

    image_storage_path: NonEmptyStoragePath
    submitted_at: datetime


class IssueOutputImageUploadUrlRequest(StrictRequestModel):
    """POST /sessions/{id}/outputs/image/upload-url の body。"""

    mime_type: OutputImageMimeType


class IssueOutputImageUploadUrlResponse(FrozenModel):
    """画像アップロード用 signed URL レスポンス。"""

    upload_url: str
    storage_path: str
    expires_at: datetime


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


class OutputResponse(FrozenModel):
    """送信済みアウトプット。

    `kind` が `text` のときは `content` が、`image` のときは `image_url` が入る。
    `image_url` は短期 TTL の signed URL のため、表示時に都度取得する想定。
    """

    id: UUID
    session_id: UUID
    kind: OutputKind
    content: str | None
    image_url: str | None
    submitted_at: datetime


class SubmitOutputResponse(FrozenModel):
    """アウトプット送信完了レスポンス。"""

    output: OutputResponse
    status: SessionStatus


class OutputReviewItemResponse(FrozenModel):
    """インプット画面で見返すためのアウトプット。"""

    session_id: UUID
    session_started_at: datetime
    input_minutes: int
    output_minutes: int
    output: OutputResponse
    cycle_index: int
    subject: str
    topic: str
    judgment: JudgmentResponse | None


class TodayOutputsResponse(FrozenModel):
    """今日のアウトプット一覧レスポンス。"""

    items: list[OutputReviewItemResponse]

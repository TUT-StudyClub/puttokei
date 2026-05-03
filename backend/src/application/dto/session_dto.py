"""セッション関連ユースケースの入出力 DTO。

CQRS 的な命名で役割を明示する。
- `CreateSessionCommand`: セッション作成の意図を表すコマンド
- `SubmitTextOutputCommand` / `SubmitImageOutputCommand`: アウトプット送信の意図を表すコマンド
- `SessionView`: クライアントに返却する読み出し用ビュー
"""

from datetime import datetime
from uuid import UUID

from src.application.dto.judgment_dto import JudgmentView
from src.common.models import FrozenModel
from src.domain.value_objects.output_kind import OutputKind
from src.domain.value_objects.session_status import SessionStatus


class CreateSessionCommand(FrozenModel):
    """POST /sessions の入力コマンド。"""

    subject: str
    topic: str
    input_minutes: int
    output_minutes: int
    break_minutes: int


class UpdateSessionStatusCommand(FrozenModel):
    """PATCH /sessions/{id} の入力コマンド。"""

    session_id: UUID
    new_status: SessionStatus


class SubmitTextOutputCommand(FrozenModel):
    """POST /sessions/{id}/outputs/text の入力コマンド。"""

    session_id: UUID
    content: str
    submitted_at: datetime


class SubmitImageOutputCommand(FrozenModel):
    """POST /sessions/{id}/outputs/image の入力コマンド。"""

    session_id: UUID
    image_storage_path: str
    submitted_at: datetime


class IssueOutputImageUploadUrlCommand(FrozenModel):
    """POST /sessions/{id}/outputs/image/upload-url の入力コマンド。"""

    session_id: UUID
    mime_type: str


class IssueOutputImageUploadUrlView(FrozenModel):
    """アップロード URL 発行結果。"""

    upload_url: str
    storage_path: str
    expires_at: datetime


class SessionView(FrozenModel):
    """セッション情報のレスポンス元ビュー。"""

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


class OutputView(FrozenModel):
    """送信済みアウトプットのビュー。

    画像 output の場合、内部 storage_path はクライアントに漏らさず、
    短期 signed URL である `image_url` のみを公開する。
    """

    id: UUID
    session_id: UUID
    kind: OutputKind
    content: str | None
    image_url: str | None
    submitted_at: datetime


class SubmitOutputView(FrozenModel):
    """アウトプット送信完了後のビュー。"""

    output: OutputView
    status: SessionStatus


class OutputReviewItemView(FrozenModel):
    """インプット画面で見返すためのアウトプットと判定情報。"""

    session_id: UUID
    session_started_at: datetime
    input_minutes: int
    output_minutes: int
    output: OutputView
    cycle_index: int
    subject: str
    topic: str
    judgment: JudgmentView | None


class TodayOutputsView(FrozenModel):
    """今日送信したアウトプット一覧。"""

    items: list[OutputReviewItemView]

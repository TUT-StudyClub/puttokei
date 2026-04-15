"""セッション関連ユースケースの入出力 DTO。

CQRS 的な命名で役割を明示する。
- `CreateSessionCommand`: セッション作成の意図を表すコマンド
- `SessionView`: クライアントに返却する読み出し用ビュー
"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.session_status import SessionStatus


class CreateSessionCommand(FrozenModel):
    """POST /sessions の入力コマンド。"""

    subject: str
    topic: str
    input_minutes: int
    output_minutes: int
    break_minutes: int


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

"""Session エンティティ。学習 1 サイクル（input/output/break/result）。

要件書 4.3.3 と Issue #13 の方針に従い、subject / topic とユーザ毎のタイマー設定を
セッション単位で保持する。タイマー設定はユーザ設定（user_settings）の値で初期化された
うえで、開始時にカスタム値で上書きされる場合があるため、セッション側にも実値を持つ。
"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.session_status import SessionStatus


class Session(FrozenModel):
    """学習 1 サイクルを表現するエンティティ。"""

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

    def with_status(
        self,
        *,
        new_status: SessionStatus,
        completed_at: datetime | None = None,
    ) -> "Session":
        """status を更新した新しい Session を返す。

        completed_at は judged / cancelled 等の終端遷移で呼び出し側から
        明示的に渡す想定。None のときは現在値を保つ（後段で None に戻す
        ケースは本ドメインでは発生しない想定）。
        """
        update: dict[str, object] = {"status": new_status}
        if completed_at is not None:
            update["completed_at"] = completed_at
        return self.model_copy(update=update)

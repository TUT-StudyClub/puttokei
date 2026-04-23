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

    def can_transition_to(self, new_status: SessionStatus) -> bool:
        """現在の status から指定 status へ遷移できるかを返す。"""
        return new_status in _ALLOWED_TRANSITIONS[self.status]

    def can_accept_output(self) -> bool:
        """アウトプット送信を受け付けられる状態かを返す。"""
        return self.status in _OUTPUT_ACCEPTABLE_STATUSES

    def can_fetch_judgment(self) -> bool:
        """判定取得フェーズに入っているかを返す。"""
        return self.status not in _JUDGMENT_UNAVAILABLE_STATUSES

    def status_after_output_submission(self) -> SessionStatus:
        """アウトプット保存後の status を返す。"""
        if self.status is SessionStatus.OUTPUT:
            return SessionStatus.JUDGING
        return self.status

    def is_terminal_status(self, status: SessionStatus) -> bool:
        """指定 status が終端状態かを返す。"""
        return status in _TERMINAL_STATUSES

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


_ALLOWED_TRANSITIONS: dict[SessionStatus, frozenset[SessionStatus]] = {
    SessionStatus.INPUT: frozenset({SessionStatus.OUTPUT, SessionStatus.CANCELLED}),
    SessionStatus.OUTPUT: frozenset({SessionStatus.JUDGING, SessionStatus.CANCELLED}),
    SessionStatus.JUDGING: frozenset({SessionStatus.JUDGED, SessionStatus.CANCELLED}),
    SessionStatus.JUDGED: frozenset(),
    SessionStatus.CANCELLED: frozenset(),
}

_TERMINAL_STATUSES: frozenset[SessionStatus] = frozenset(
    {SessionStatus.JUDGED, SessionStatus.CANCELLED}
)
_OUTPUT_ACCEPTABLE_STATUSES: frozenset[SessionStatus] = frozenset(
    {SessionStatus.OUTPUT, SessionStatus.JUDGING}
)
_JUDGMENT_UNAVAILABLE_STATUSES: frozenset[SessionStatus] = frozenset(
    {SessionStatus.INPUT, SessionStatus.OUTPUT}
)

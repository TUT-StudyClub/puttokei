"""PATCH /sessions/{id} の UseCase。

Session.status の遷移は有限状態機械として扱い、許可された遷移のみ通す。
判定 (judging→judged) はダミー扱いで、本 Task では API が状態を進めるだけの
役割に留める。LLM 判定の実呼び出しは Epic #4 のスコープ。
"""

from datetime import UTC, datetime

from src.application.dto.session_dto import SessionView, UpdateSessionStatusCommand
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.repositories.session_repository import SessionRepository
from src.domain.value_objects.session_status import SessionStatus


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーの session のため参照できない。

    enumeration 対策として「他ユーザー」と「存在しない」は呼び出し側で区別しない。
    """


class InvalidSessionStatusTransitionError(Exception):
    """許可されていない status 遷移を要求された。"""


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


class UpdateSessionStatus:
    """Session の status を許可された遷移のみで更新する。"""

    def __init__(self, session_repository: SessionRepository) -> None:
        self.session_repository = session_repository

    async def execute(self, current_user: User, command: UpdateSessionStatusCommand) -> SessionView:
        session = await self.session_repository.find_by_id(command.session_id)
        if session is None or session.user_id != current_user.id:
            raise SessionNotFoundError("session not found")

        if command.new_status not in _ALLOWED_TRANSITIONS[session.status]:
            raise InvalidSessionStatusTransitionError(
                f"cannot transition from {session.status.value} to {command.new_status.value}"
            )

        completed_at: datetime | None = None
        if command.new_status in _TERMINAL_STATUSES:
            completed_at = datetime.now(UTC)

        updated = session.with_status(new_status=command.new_status, completed_at=completed_at)
        await self.session_repository.update(updated)
        return _to_view(updated)


def _to_view(session: Session) -> SessionView:
    return SessionView(
        id=session.id,
        user_id=session.user_id,
        status=session.status,
        subject=session.subject,
        topic=session.topic,
        input_minutes=session.input_minutes,
        output_minutes=session.output_minutes,
        break_minutes=session.break_minutes,
        started_at=session.started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
    )

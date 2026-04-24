"""PATCH /sessions/{id} の UseCase。"""

from datetime import UTC, datetime

from src.application.dto.session_dto import SessionView, UpdateSessionStatusCommand
from src.application.mappers.session_mapper import to_session_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーの session のため参照できない。

    enumeration 対策として「他ユーザー」と「存在しない」は呼び出し側で区別しない。
    """


class InvalidSessionStatusTransitionError(Exception):
    """許可されていない status 遷移を要求された。"""


class UpdateSessionStatus:
    """Session の status を許可された遷移のみで更新する。"""

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(self, current_user: User, command: UpdateSessionStatusCommand) -> SessionView:
        async with self.unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(command.session_id)
            if session is None or session.user_id != current_user.id:
                raise SessionNotFoundError("session not found")

            if not session.can_transition_to(command.new_status):
                raise InvalidSessionStatusTransitionError(
                    f"cannot transition from {session.status.value} to {command.new_status.value}"
                )

            completed_at: datetime | None = None
            if session.is_terminal_status(command.new_status):
                completed_at = datetime.now(UTC)

            updated = session.with_status(
                new_status=command.new_status,
                completed_at=completed_at,
            )
            await uow.sessions.update(updated)
            await uow.commit()
        return to_session_view(updated)

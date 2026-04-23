"""POST /sessions の UseCase。"""

from datetime import UTC, datetime
from uuid import uuid4

from src.application.dto.session_dto import CreateSessionCommand, SessionView
from src.application.mappers.session_mapper import to_session_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.value_objects.session_status import SessionStatus


class CreateSession:
    """新規 Session を作成し、初期ステータス INPUT で永続化する。"""

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(self, current_user: User, command: CreateSessionCommand) -> SessionView:
        now = datetime.now(UTC)
        session = Session(
            id=uuid4(),
            user_id=current_user.id,
            status=SessionStatus.INPUT,
            subject=command.subject,
            topic=command.topic,
            input_minutes=command.input_minutes,
            output_minutes=command.output_minutes,
            break_minutes=command.break_minutes,
            started_at=now,
            completed_at=None,
            created_at=now,
        )
        async with self.unit_of_work_factory() as uow:
            await uow.sessions.add(session)
            await uow.commit()
        return to_session_view(session)

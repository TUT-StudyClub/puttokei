"""POST /sessions の UseCase。"""

from datetime import UTC, datetime
from uuid import uuid4

from src.application.dto.session_dto import CreateSessionCommand, SessionView
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.repositories.session_repository import SessionRepository
from src.domain.value_objects.session_status import SessionStatus


class CreateSession:
    """新規 Session を作成し、初期ステータス INPUT で永続化する。"""

    def __init__(self, session_repository: SessionRepository) -> None:
        self._session_repository = session_repository

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
        await self._session_repository.add(session)
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

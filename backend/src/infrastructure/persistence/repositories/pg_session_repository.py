"""Session リポジトリの PostgreSQL 実装。"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.session import Session
from src.domain.repositories.session_repository import SessionRepository
from src.domain.value_objects.session_status import SessionStatus
from src.infrastructure.persistence.models.session_model import SessionModel


class PgSessionRepository(SessionRepository):
    """PostgreSQL 実装。commit / rollback は Unit of Work が担う。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, session: Session) -> None:
        self._session.add(
            SessionModel(
                id=session.id,
                user_id=session.user_id,
                status=session.status.value,
                subject=session.subject,
                topic=session.topic,
                input_minutes=session.input_minutes,
                output_minutes=session.output_minutes,
                break_minutes=session.break_minutes,
                started_at=session.started_at,
                completed_at=session.completed_at,
                created_at=session.created_at,
            )
        )
        await self._session.flush()

    async def find_by_id(self, session_id: UUID) -> Session | None:
        stmt = select(SessionModel).where(SessionModel.id == session_id)
        result = await self._session.execute(stmt)
        row = result.scalar_one_or_none()
        return _to_session(row) if row is not None else None

    async def update(self, session: Session) -> None:
        stmt = select(SessionModel).where(SessionModel.id == session.id)
        result = await self._session.execute(stmt)
        model = result.scalar_one()
        model.status = session.status.value
        model.subject = session.subject
        model.topic = session.topic
        model.input_minutes = session.input_minutes
        model.output_minutes = session.output_minutes
        model.break_minutes = session.break_minutes
        model.started_at = session.started_at
        model.completed_at = session.completed_at
        await self._session.flush()

    async def list_by_user(
        self,
        user_id: UUID,
        cursor: str | None,
        limit: int,
    ) -> tuple[list[Session], str | None]:
        raise NotImplementedError("履歴一覧エンドポイントの Task で実装する")


def _to_session(model: SessionModel) -> Session:
    """ORM モデル → domain.Session の変換。"""
    return Session(
        id=model.id,
        user_id=model.user_id,
        status=SessionStatus(model.status),
        subject=model.subject,
        topic=model.topic,
        input_minutes=model.input_minutes,
        output_minutes=model.output_minutes,
        break_minutes=model.break_minutes,
        started_at=model.started_at,
        completed_at=model.completed_at,
        created_at=model.created_at,
    )

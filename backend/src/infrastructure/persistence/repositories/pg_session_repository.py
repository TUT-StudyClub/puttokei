"""Session リポジトリの PostgreSQL 実装。

Issue #41 で `find_by_id` / `update` を実装。`list_by_user` は履歴一覧 API を
扱う別 Task で実装する想定のため、呼び出されたら `NotImplementedError` で
気づけるようにしておく。
"""

from uuid import UUID

from sqlalchemy import select

from src.domain.entities.session import Session
from src.domain.repositories.session_repository import SessionRepository
from src.domain.value_objects.session_status import SessionStatus
from src.infrastructure.persistence.database import Database
from src.infrastructure.persistence.models.session_model import SessionModel


class PgSessionRepository(SessionRepository):
    """PostgreSQL 実装。`Database` から都度セッションを開いて操作する。"""

    def __init__(self, database: Database) -> None:
        self._database = database

    async def add(self, session: Session) -> None:
        async with self._database.session() as db_session:
            db_session.add(
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
            await db_session.commit()

    async def find_by_id(self, session_id: UUID) -> Session | None:
        async with self._database.session() as db_session:
            stmt = select(SessionModel).where(SessionModel.id == session_id)
            result = await db_session.execute(stmt)
            row = result.scalar_one_or_none()
            return _to_session(row) if row is not None else None

    async def update(self, session: Session) -> None:
        async with self._database.session() as db_session:
            stmt = select(SessionModel).where(SessionModel.id == session.id)
            result = await db_session.execute(stmt)
            model = result.scalar_one()
            model.status = session.status.value
            model.subject = session.subject
            model.topic = session.topic
            model.input_minutes = session.input_minutes
            model.output_minutes = session.output_minutes
            model.break_minutes = session.break_minutes
            model.started_at = session.started_at
            model.completed_at = session.completed_at
            await db_session.commit()

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

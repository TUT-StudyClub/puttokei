"""Session リポジトリの PostgreSQL 実装。

本 PR では Issue #38 / #39 のスコープに合わせて `add` のみ実装する。
`find_by_id` / `update` / `list_by_user` は Epic #3 の後続 Task で実装するため、
呼び出された時点で `NotImplementedError` を投げて気づけるようにしておく。
"""

from uuid import UUID

from src.domain.entities.session import Session
from src.domain.repositories.session_repository import SessionRepository
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
        raise NotImplementedError("Epic #3 後続 Task で実装する")

    async def update(self, session: Session) -> None:
        raise NotImplementedError("Epic #3 後続 Task で実装する")

    async def list_by_user(
        self,
        user_id: UUID,
        cursor: str | None,
        limit: int,
    ) -> tuple[list[Session], str | None]:
        raise NotImplementedError("Epic #3 後続 Task で実装する")

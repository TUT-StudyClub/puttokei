"""インメモリな SessionRepository 実装。"""

from uuid import UUID

from src.domain.entities.session import Session
from src.domain.repositories.session_repository import SessionRepository


class FakeSessionRepository(SessionRepository):
    """in-memory な SessionRepository。テスト以外で使用しない。"""

    def __init__(self) -> None:
        self.sessions: dict[UUID, Session] = {}

    async def add(self, session: Session) -> None:
        self.sessions[session.id] = session

    async def find_by_id(self, session_id: UUID) -> Session | None:
        return self.sessions.get(session_id)

    async def update(self, session: Session) -> None:
        self.sessions[session.id] = session

    async def list_by_user(
        self,
        user_id: UUID,
        cursor: str | None,  # noqa: ARG002
        limit: int,
    ) -> tuple[list[Session], str | None]:
        items = [s for s in self.sessions.values() if s.user_id == user_id]
        return items[:limit], None

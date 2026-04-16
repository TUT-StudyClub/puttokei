"""インメモリな JudgmentRepository 実装。"""

from uuid import UUID

from src.domain.entities.judgment import Judgment
from src.domain.repositories.judgment_repository import JudgmentRepository


class FakeJudgmentRepository(JudgmentRepository):
    """in-memory な JudgmentRepository。テスト以外で使用しない。"""

    def __init__(self) -> None:
        self.judgments_by_id: dict[UUID, Judgment] = {}
        self.judgments_by_session_id: dict[UUID, Judgment] = {}

    async def add(self, judgment: Judgment) -> None:
        self.judgments_by_id[judgment.id] = judgment
        self.judgments_by_session_id[judgment.session_id] = judgment

    async def find_by_id(self, judgment_id: UUID) -> Judgment | None:
        return self.judgments_by_id.get(judgment_id)

    async def find_by_session_id(self, session_id: UUID) -> Judgment | None:
        return self.judgments_by_session_id.get(session_id)

    async def list_by_user(
        self,
        user_id: UUID,  # noqa: ARG002
        cursor: str | None,  # noqa: ARG002
        limit: int,
    ) -> tuple[list[Judgment], str | None]:
        items = list(self.judgments_by_id.values())
        return items[:limit], None

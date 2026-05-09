"""インメモリな JudgmentRepository 実装。"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from src.domain.entities.judgment import Judgment
from src.domain.repositories.judgment_repository import JudgmentRepository
from src.domain.value_objects.judgment_query import JudgmentListCursor, JudgmentSort
from src.domain.value_objects.verdict import Verdict

if TYPE_CHECKING:
    from tests.fakes.fake_session_repository import FakeSessionRepository


class FakeJudgmentRepository(JudgmentRepository):
    """in-memory な JudgmentRepository。テスト以外で使用しない。"""

    def __init__(self) -> None:
        self.judgments_by_id: dict[UUID, Judgment] = {}
        self.judgments_by_session_id: dict[UUID, Judgment] = {}
        self._sessions: FakeSessionRepository | None = None

    def bind_sessions(self, sessions: FakeSessionRepository) -> None:
        self._sessions = sessions

    async def add(self, judgment: Judgment) -> None:
        self.judgments_by_id[judgment.id] = judgment
        self.judgments_by_session_id[judgment.session_id] = judgment

    async def find_by_id(self, judgment_id: UUID) -> Judgment | None:
        return self.judgments_by_id.get(judgment_id)

    async def find_by_session_id(self, session_id: UUID) -> Judgment | None:
        return self.judgments_by_session_id.get(session_id)

    async def list_by_user(
        self,
        user_id: UUID,
        cursor: JudgmentListCursor | None,
        limit: int,
        *,
        verdict: Verdict | None = None,
        judged_from: datetime | None = None,
        judged_to: datetime | None = None,
        sort: JudgmentSort = JudgmentSort.JUDGED_AT_DESC,
    ) -> tuple[list[Judgment], JudgmentListCursor | None]:
        items = [
            judgment
            for judgment in self.judgments_by_id.values()
            if self._belongs_to_user(judgment, user_id)
        ]
        if verdict is not None:
            items = [judgment for judgment in items if judgment.verdict is verdict]
        if judged_from is not None:
            items = [judgment for judgment in items if judgment.judged_at >= judged_from]
        if judged_to is not None:
            items = [judgment for judgment in items if judgment.judged_at <= judged_to]
        if cursor is not None:
            items = [
                judgment
                for judgment in items
                if _is_after_cursor(judgment, cursor=cursor, sort=sort)
            ]

        reverse = sort is JudgmentSort.JUDGED_AT_DESC
        items.sort(key=lambda judgment: (judgment.judged_at, judgment.id.int), reverse=reverse)

        next_cursor = None
        if len(items) > limit:
            cursor_item = items[limit - 1]
            next_cursor = JudgmentListCursor(
                judged_at=cursor_item.judged_at,
                judgment_id=cursor_item.id,
            )
            items = items[:limit]

        return items, next_cursor

    def _belongs_to_user(self, judgment: Judgment, user_id: UUID) -> bool:
        if self._sessions is None:
            return True
        session = self._sessions.sessions.get(judgment.session_id)
        return session is not None and session.user_id == user_id


def _is_after_cursor(
    judgment: Judgment,
    *,
    cursor: JudgmentListCursor,
    sort: JudgmentSort,
) -> bool:
    judgment_key = (judgment.judged_at, judgment.id.int)
    cursor_key = (cursor.judged_at, cursor.judgment_id.int)
    if sort is JudgmentSort.JUDGED_AT_ASC:
        return judgment_key > cursor_key
    return judgment_key < cursor_key

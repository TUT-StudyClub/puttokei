"""Judgment リポジトリの抽象 IF。

具体実装は `infrastructure/persistence/repositories/pg_judgment_repository.py` で
Epic #4 / Epic #5 に組み込む。
"""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from src.domain.entities.judgment import Judgment
from src.domain.value_objects.judgment_query import JudgmentListCursor, JudgmentSort
from src.domain.value_objects.verdict import Verdict


class JudgmentRepository(ABC):
    """Judgment の永続化に対する抽象 IF。"""

    @abstractmethod
    async def add(self, judgment: Judgment) -> None:
        """新規判定結果を保存する。"""

    @abstractmethod
    async def find_by_id(self, judgment_id: UUID) -> Judgment | None:
        """判定 ID で取得する。"""

    @abstractmethod
    async def find_by_session_id(self, session_id: UUID) -> Judgment | None:
        """セッション ID から関連する判定を取得する。1 セッション 1 判定の前提。"""

    @abstractmethod
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
        """ユーザー単位で判定履歴をカーソル付きで返す。"""

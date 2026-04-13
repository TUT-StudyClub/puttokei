"""Session リポジトリの抽象 IF。

具体実装は `infrastructure/persistence/repositories/pg_session_repository.py` で
Epic #3 に組み込む。
"""

from abc import ABC, abstractmethod
from uuid import UUID

from src.domain.entities.session import Session


class SessionRepository(ABC):
    """Session の永続化に対する抽象 IF。"""

    @abstractmethod
    async def add(self, session: Session) -> None:
        """新規セッションを保存する。"""

    @abstractmethod
    async def find_by_id(self, session_id: UUID) -> Session | None:
        """セッション ID で取得する。存在しなければ None。"""

    @abstractmethod
    async def update(self, session: Session) -> None:
        """セッションのステータスやタイマーを更新する。"""

    @abstractmethod
    async def list_by_user(
        self,
        user_id: UUID,
        cursor: str | None,
        limit: int,
    ) -> tuple[list[Session], str | None]:
        """ユーザー単位でセッション履歴をカーソル付きで返す。"""

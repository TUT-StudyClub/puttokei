"""JudgmentProgress リポジトリの抽象 IF。"""

from abc import ABC, abstractmethod
from uuid import UUID

from src.domain.entities.judgment_progress import JudgmentProgress


class JudgmentProgressRepository(ABC):
    """JudgmentProgress の永続化に対する抽象 IF。"""

    @abstractmethod
    async def upsert(self, progress: JudgmentProgress) -> None:
        """セッション単位の判定進捗を追加または更新する。"""

    @abstractmethod
    async def find_by_session_id(self, session_id: UUID) -> JudgmentProgress | None:
        """セッション ID から判定進捗を取得する。"""

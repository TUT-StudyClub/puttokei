"""Output リポジトリの抽象 IF。"""

from abc import ABC, abstractmethod
from uuid import UUID

from src.domain.entities.output import Output


class OutputRepository(ABC):
    """Output の永続化に対する抽象 IF。"""

    @abstractmethod
    async def upsert(self, output: Output) -> None:
        """セッションに紐づくアウトプットを保存または更新する。"""

    @abstractmethod
    async def find_by_session_id(self, session_id: UUID) -> Output | None:
        """セッション ID からアウトプットを取得する。"""

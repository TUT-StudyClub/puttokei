"""User リポジトリの抽象 IF。

具体実装は `infrastructure/persistence/repositories/pg_user_repository.py` で
Epic #2 に組み込む。
"""

from abc import ABC, abstractmethod

from src.domain.entities.user import User


class UserRepository(ABC):
    """User の永続化に対する抽象 IF。"""

    @abstractmethod
    async def find_by_firebase_uid(self, firebase_uid: str) -> User | None:
        """Firebase UID から内部ユーザを取得する。未登録時は None。"""

    @abstractmethod
    async def add(self, user: User) -> None:
        """新規ユーザを保存する。"""

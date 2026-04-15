"""User リポジトリの抽象 IF。

具体実装は `infrastructure/persistence/repositories/pg_user_repository.py`。
"""

from abc import ABC, abstractmethod

from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings


class UserRepository(ABC):
    """User の永続化に対する抽象 IF。"""

    @abstractmethod
    async def find_by_firebase_uid(self, firebase_uid: str) -> User | None:
        """Firebase UID から内部ユーザを取得する。未登録時は None。"""

    @abstractmethod
    async def add(self, user: User, settings: UserSettings) -> None:
        """新規ユーザと初期設定を同一トランザクションで保存する。"""

    @abstractmethod
    async def update(self, user: User) -> None:
        """既存ユーザのプロフィールを更新する。"""

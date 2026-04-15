"""インメモリな UserRepository 実装。"""

from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.repositories.user_repository import UserRepository


class FakeUserRepository(UserRepository):
    """in-memory な UserRepository。テスト以外で使用しない。"""

    def __init__(self) -> None:
        self.users: dict[str, User] = {}
        self.settings: dict[str, UserSettings] = {}

    async def find_by_firebase_uid(self, firebase_uid: str) -> User | None:
        return self.users.get(firebase_uid)

    async def add(self, user: User, settings: UserSettings) -> None:
        self.users[user.firebase_uid] = user
        self.settings[user.firebase_uid] = settings

    async def update(self, user: User) -> None:
        self.users[user.firebase_uid] = user

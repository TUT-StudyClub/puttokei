"""インメモリな UserRepository 実装。"""

from uuid import UUID

from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.repositories.user_repository import (
    UserAlreadyExistsError,
    UserRepository,
)


class FakeUserRepository(UserRepository):
    """in-memory な UserRepository。テスト以外で使用しない。"""

    def __init__(self) -> None:
        self.users: dict[str, User] = {}
        # user_id (UUID) をキーにする。AuthenticateUser が add 直後に
        # find_settings_by_user_id で参照できるように対応させる。
        self.settings: dict[UUID, UserSettings] = {}

    async def find_by_firebase_uid(self, firebase_uid: str) -> User | None:
        user = self.users.get(firebase_uid)
        if user is None or user.deleted_at is not None:
            return None
        return user

    async def add(self, user: User, settings: UserSettings) -> None:
        if user.firebase_uid in self.users:
            raise UserAlreadyExistsError(f"firebase_uid={user.firebase_uid} already exists")
        self.users[user.firebase_uid] = user
        self.settings[settings.user_id] = settings

    async def update(self, user: User) -> None:
        self.users[user.firebase_uid] = user

    async def find_settings_by_user_id(self, user_id: UUID) -> UserSettings | None:
        return self.settings.get(user_id)

    async def update_settings(self, settings: UserSettings) -> None:
        self.settings[settings.user_id] = settings

    async def delete_by_id(self, user_id: UUID) -> None:
        target_uid = next(
            (firebase_uid for firebase_uid, u in self.users.items() if u.id == user_id),
            None,
        )
        if target_uid is not None:
            del self.users[target_uid]
        self.settings.pop(user_id, None)

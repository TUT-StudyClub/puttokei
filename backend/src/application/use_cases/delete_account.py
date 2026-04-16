"""DELETE /users/me の UseCase。

DB 上の users 行を削除すると、FK ondelete=CASCADE 設定により
user_settings / sessions / outputs / judgments も連鎖削除される。
Firebase Authentication 上のアカウント自体の削除は本 UseCase の責務外で、
mobile 側で signOut させる方針。
"""

from src.domain.entities.user import User
from src.domain.repositories.user_repository import UserRepository


class DeleteAccount:
    """認証済みユーザ自身のアカウントを削除する。"""

    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    async def execute(self, current_user: User) -> None:
        await self._user_repository.delete_by_id(current_user.id)

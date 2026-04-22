"""DELETE /users/me の UseCase（論理削除）。

`users.deleted_at` をセットし、`fcm_token` をクリアする。user_settings / sessions /
outputs / judgments は FK ondelete=CASCADE を張っているが、本 UseCase では DB 行
を物理削除しないため連鎖削除は発生しない。30 日後のバッチジョブ（Issue #61）で
物理削除される時点で FK CASCADE が効く。Firebase Authentication 上のアカウント
自体の削除は本 UseCase の責務外で、mobile 側で signOut させる方針。
"""

from datetime import UTC, datetime

from src.domain.entities.user import User
from src.domain.repositories.user_repository import UserRepository


class DeleteAccount:
    """認証済みユーザ自身のアカウントを論理削除する。"""

    def __init__(self, user_repository: UserRepository) -> None:
        self.user_repository = user_repository

    async def execute(self, current_user: User) -> None:
        if current_user.deleted_at is not None:
            # auth_middleware が生きているユーザのみ渡す前提だが、冪等性のため
            # 既に削除済みなら no-op として扱う。
            return
        soft_deleted = current_user.with_deleted_at(deleted_at=datetime.now(UTC))
        await self.user_repository.update(soft_deleted)

"""DELETE /users/me の UseCase（即時物理削除）。

退会方針:
1. Firebase Auth ユーザを削除する
   - UserNotFound（既に Firebase 側に存在しない）は握り潰して退会を続行する
   - その他のエラーは例外をそのまま伝播し、DB 削除はスキップする
2. DB の users 行を物理削除する
   - delete_by_id は rowcount=0 を許容する（冪等）
   - commit 後、FK ondelete=CASCADE により user_settings / sessions / outputs / judgments
     などの関連データも削除される

注意:
- Firebase 削除と DB 削除は原子的ではない。Firebase 削除成功後に DB 削除が失敗した
  場合は Firebase 側だけが削除済みで DB 行が残る可能性がある。本実装では補償ジョブや
  リトライキューは設けず、運用上のレアケースとして許容する。
- `users.deleted_at` カラムや `User.with_deleted_at()` は本 UseCase では使用しないが、
  将来の運用変更（30 日猶予への回帰など）に備えて削除せず残している。
- 退会後に同じ外部認証アカウントで再ログインした場合は、新規ユーザーとして再登録される
  想定とする（Firebase UID 再利用に関する仕様の断言はしない）。
"""

import contextlib

from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User
from src.domain.services.auth_account_admin import (
    AuthAccountAdmin,
    AuthAccountNotFoundError,
)


class DeleteAccount:
    """認証済みユーザ自身のアカウントを Firebase Auth ごと物理削除する。"""

    def __init__(
        self,
        unit_of_work_factory: UnitOfWorkFactory,
        auth_account_admin: AuthAccountAdmin,
    ) -> None:
        self._unit_of_work_factory = unit_of_work_factory
        self._auth_account_admin = auth_account_admin

    async def execute(self, current_user: User) -> None:
        # 1) Firebase Auth ユーザの削除。NotFound は冪等に成功扱い、それ以外は例外伝播。
        with contextlib.suppress(AuthAccountNotFoundError):
            await self._auth_account_admin.delete_user(current_user.firebase_uid)

        # 2) DB users 行の物理削除（FK CASCADE で関連データも削除される）。
        async with self._unit_of_work_factory() as uow:
            await uow.users.delete_by_id(current_user.id)
            await uow.commit()

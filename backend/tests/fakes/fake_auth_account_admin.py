"""テスト用の AuthAccountAdmin fake。

呼び出された uid を `deleted_uids` に記録する。`not_found_uids` に含まれる uid は
`AuthAccountNotFoundError` を送出し、`error_uid_to_raise` に登録された uid は任意の
例外を再現する。
"""

from src.domain.services.auth_account_admin import (
    AuthAccountAdmin,
    AuthAccountNotFoundError,
)


class FakeAuthAccountAdmin(AuthAccountAdmin):
    def __init__(self) -> None:
        self.deleted_uids: list[str] = []
        self.not_found_uids: set[str] = set()
        self.error_uid_to_raise: dict[str, Exception] = {}

    async def delete_user(self, uid: str) -> None:
        self.deleted_uids.append(uid)
        if uid in self.error_uid_to_raise:
            raise self.error_uid_to_raise[uid]
        if uid in self.not_found_uids:
            raise AuthAccountNotFoundError(uid)

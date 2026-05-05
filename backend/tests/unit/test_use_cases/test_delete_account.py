"""DeleteAccount UseCase の振る舞い（即時物理削除）。

退会フローの方針:
- Firebase Auth ユーザを削除 → DB users 行を物理削除（FK CASCADE で関連連鎖）
- Firebase の UserNotFound は握り潰す
- それ以外の Firebase エラーは伝播し、DB 削除はスキップする
- Firebase 成功 + DB 失敗の非原子性は許容（補償処理は本実装にない）
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.use_cases.delete_account import DeleteAccount
from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.value_objects.auth_provider import AuthProvider
from tests.fakes.fake_auth_account_admin import FakeAuthAccountAdmin
from tests.fakes.fake_unit_of_work import FakeUnitOfWork
from tests.fakes.fake_user_repository import FakeUserRepository


def _make_user_with_settings() -> tuple[User, UserSettings]:
    now = datetime.now(UTC)
    user = User(
        id=uuid4(),
        firebase_uid="uid-001",
        auth_provider=AuthProvider.GOOGLE,
        created_at=now,
        updated_at=now,
    ).model_copy(update={"fcm_token": "fcm-xyz"})
    settings = UserSettings(
        id=uuid4(),
        user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    return user, settings


def _build_use_case(
    repo: FakeUserRepository,
    auth_admin: FakeAuthAccountAdmin,
) -> DeleteAccount:
    return DeleteAccount(
        unit_of_work_factory=lambda: FakeUnitOfWork(users=repo),
        auth_account_admin=auth_admin,
    )


@pytest.mark.asyncio
async def test_execute_deletes_firebase_user_and_db_row():
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)
    auth_admin = FakeAuthAccountAdmin()

    await _build_use_case(repo, auth_admin).execute(user)

    # Firebase 削除が呼ばれた
    assert auth_admin.deleted_uids == [user.firebase_uid]
    # DB 上の users 行と user_settings が消えている
    assert user.firebase_uid not in repo.users
    assert user.id not in repo.settings


@pytest.mark.asyncio
async def test_execute_swallows_firebase_user_not_found_and_continues_db_delete():
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)
    auth_admin = FakeAuthAccountAdmin()
    auth_admin.not_found_uids.add(user.firebase_uid)

    await _build_use_case(repo, auth_admin).execute(user)

    # NotFound は握り潰される (例外は出ない)
    assert auth_admin.deleted_uids == [user.firebase_uid]
    # DB 削除はそのまま実行される
    assert user.firebase_uid not in repo.users


@pytest.mark.asyncio
async def test_execute_propagates_firebase_error_without_db_delete():
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)
    auth_admin = FakeAuthAccountAdmin()
    auth_admin.error_uid_to_raise[user.firebase_uid] = RuntimeError("firebase down")

    with pytest.raises(RuntimeError, match="firebase down"):
        await _build_use_case(repo, auth_admin).execute(user)

    # DB は無変更
    assert user.firebase_uid in repo.users
    assert user.id in repo.settings


@pytest.mark.asyncio
async def test_execute_propagates_db_error_after_firebase_delete_succeeded():
    """非原子性を許容する設計の確認。

    Firebase 削除は成功したが DB 削除で例外が発生した場合、例外は呼び出し元へ伝播する。
    Firebase 側は既に削除済みのままになるが、本実装では補償処理は行わない。
    """
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)
    auth_admin = FakeAuthAccountAdmin()

    async def _raise_db_error(_user_id):  # noqa: ANN001 -- monkeypatched stub
        raise RuntimeError("db down")

    repo.delete_by_id = _raise_db_error  # type: ignore[method-assign]

    with pytest.raises(RuntimeError, match="db down"):
        await _build_use_case(repo, auth_admin).execute(user)

    # Firebase 削除は呼ばれた
    assert auth_admin.deleted_uids == [user.firebase_uid]


@pytest.mark.asyncio
async def test_execute_is_idempotent_when_db_row_already_missing():
    """既に DB 行が無いユーザーへの再実行も例外にならない。"""
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)
    auth_admin = FakeAuthAccountAdmin()

    use_case = _build_use_case(repo, auth_admin)
    await use_case.execute(user)
    # 2 回目: DB 行は既に消えているが例外にはならない
    auth_admin.not_found_uids.add(user.firebase_uid)
    await use_case.execute(user)

    assert user.firebase_uid not in repo.users
    assert auth_admin.deleted_uids == [user.firebase_uid, user.firebase_uid]

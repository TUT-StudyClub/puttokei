"""DeleteAccount UseCase の振る舞い（論理削除）。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.use_cases.delete_account import DeleteAccount
from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.value_objects.auth_provider import AuthProvider
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


@pytest.mark.asyncio
async def test_delete_account_soft_deletes_user_and_preserves_settings():
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)

    use_case = DeleteAccount(unit_of_work_factory=lambda: FakeUnitOfWork(users=repo))
    await use_case.execute(user)

    # 行は残り、deleted_at がセットされ、fcm_token がクリアされる
    stored = repo.users[user.firebase_uid]
    assert stored.deleted_at is not None
    assert stored.fcm_token is None
    # user_settings は保持される（30 日後バッチで物理削除されるまで残す）
    assert user.id in repo.settings
    # find_by_firebase_uid 経由では生きているユーザとして見えない
    assert await repo.find_by_firebase_uid(user.firebase_uid) is None


@pytest.mark.asyncio
async def test_delete_account_is_idempotent():
    """既に削除済みのユーザーに対して例外を投げず、deleted_at も上書きしない。"""
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)

    use_case = DeleteAccount(unit_of_work_factory=lambda: FakeUnitOfWork(users=repo))
    await use_case.execute(user)
    first_deleted_at = repo.users[user.firebase_uid].deleted_at
    assert first_deleted_at is not None

    # 既に削除済みの User を渡しても例外にならず、deleted_at も上書きされない
    already_deleted = repo.users[user.firebase_uid]
    await use_case.execute(already_deleted)
    assert repo.users[user.firebase_uid].deleted_at == first_deleted_at

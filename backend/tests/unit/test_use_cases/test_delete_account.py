"""DeleteAccount UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.use_cases.delete_account import DeleteAccount
from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.value_objects.auth_provider import AuthProvider
from tests.fakes.fake_user_repository import FakeUserRepository


def _make_user_with_settings() -> tuple[User, UserSettings]:
    now = datetime.now(UTC)
    user = User(
        id=uuid4(),
        firebase_uid="uid-001",
        auth_provider=AuthProvider.GOOGLE,
        created_at=now,
        updated_at=now,
    )
    settings = UserSettings(
        id=uuid4(),
        user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    return user, settings


@pytest.mark.asyncio
async def test_delete_account_removes_user_and_settings():
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)
    assert user.firebase_uid in repo.users
    assert user.id in repo.settings

    use_case = DeleteAccount(user_repository=repo)
    await use_case.execute(user)

    assert user.firebase_uid not in repo.users
    assert user.id not in repo.settings


@pytest.mark.asyncio
async def test_delete_account_is_idempotent():
    """既に削除済みのユーザーに対して例外を投げないことを担保する。"""
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)

    use_case = DeleteAccount(user_repository=repo)
    await use_case.execute(user)
    # 2 度目の呼び出しでも例外にならない
    await use_case.execute(user)

    assert user.firebase_uid not in repo.users

"""AuthenticateUser UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.use_cases.authenticate_user import (
    AuthenticateUser,
    DeletedAccountAuthenticationError,
    InvalidAuthenticationTokenError,
)
from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.value_objects.auth_provider import AuthProvider
from tests.fakes.fake_auth_verifier import FakeAuthVerifier
from tests.fakes.fake_unit_of_work import FakeUnitOfWork
from tests.fakes.fake_user_repository import FakeUserRepository


def _make_user(firebase_uid: str = "uid-001") -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid=firebase_uid,
        auth_provider=AuthProvider.GOOGLE,
        created_at=now,
        updated_at=now,
    )


def _make_settings(user: User) -> UserSettings:
    now = datetime.now(UTC)
    return UserSettings(
        id=uuid4(),
        user_id=user.id,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_returns_existing_user_without_commit():
    repo = FakeUserRepository()
    user = _make_user()
    await repo.add(user, _make_settings(user))
    uow = FakeUnitOfWork(users=repo)
    use_case = AuthenticateUser(
        auth_verifier=FakeAuthVerifier(),
        unit_of_work_factory=lambda: uow,
    )

    result = await use_case.execute(user.firebase_uid)

    assert result.user == user
    assert result.is_new is False
    assert uow.commit_count == 0
    assert uow.rollback_count == 1


@pytest.mark.asyncio
async def test_auto_creates_user_and_settings():
    repo = FakeUserRepository()
    uow = FakeUnitOfWork(users=repo)
    use_case = AuthenticateUser(
        auth_verifier=FakeAuthVerifier(),
        unit_of_work_factory=lambda: uow,
    )

    result = await use_case.execute("new-user:apple.com")

    assert result.is_new is True
    assert result.user.firebase_uid == "new-user"
    assert result.user.auth_provider is AuthProvider.APPLE
    assert result.user.onboarding_completed is False
    assert result.user.id in repo.settings
    assert result.user.created_at.utcoffset() == UTC.utcoffset(None)
    assert repo.settings[result.user.id].created_at.utcoffset() == UTC.utcoffset(None)
    assert uow.commit_count == 1
    assert uow.rollback_count == 0


@pytest.mark.asyncio
async def test_raises_invalid_token_error_without_opening_uow():
    uow = FakeUnitOfWork()
    use_case = AuthenticateUser(
        auth_verifier=FakeAuthVerifier(),
        unit_of_work_factory=lambda: uow,
    )

    with pytest.raises(InvalidAuthenticationTokenError):
        await use_case.execute("invalid-token")

    assert uow.enter_count == 0
    assert uow.commit_count == 0


@pytest.mark.asyncio
async def test_raises_deleted_account_error_for_deleted_uid_collision():
    repo = FakeUserRepository()
    user = _make_user("deleted-user")
    await repo.add(user, _make_settings(user))
    repo.users[user.firebase_uid] = user.with_deleted_at(deleted_at=datetime.now(UTC))
    uow = FakeUnitOfWork(users=repo)
    use_case = AuthenticateUser(
        auth_verifier=FakeAuthVerifier(),
        unit_of_work_factory=lambda: uow,
    )

    with pytest.raises(DeletedAccountAuthenticationError):
        await use_case.execute("deleted-user")

    assert uow.commit_count == 0
    assert uow.rollback_count == 1

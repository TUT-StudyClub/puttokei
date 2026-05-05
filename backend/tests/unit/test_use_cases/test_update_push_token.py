"""UpdatePushToken UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.dto.user_dto import UpdatePushTokenCommand
from src.application.use_cases.update_push_token import UpdatePushToken
from src.domain.entities.user import User
from src.domain.value_objects.auth_provider import AuthProvider
from tests.fakes.fake_unit_of_work import FakeUnitOfWork
from tests.fakes.fake_user_repository import FakeUserRepository


def _make_user(*, fcm_token: str | None = None) -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid="uid-push-001",
        auth_provider=AuthProvider.GOOGLE,
        display_name=None,
        age_group=None,
        onboarding_completed=True,
        fcm_token=fcm_token,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_update_push_token_persists_token():
    repo = FakeUserRepository()
    user = _make_user()
    repo.users[user.firebase_uid] = user
    uow = FakeUnitOfWork(users=repo)

    use_case = UpdatePushToken(unit_of_work_factory=lambda: uow)
    await use_case.execute(user, UpdatePushTokenCommand(fcm_token="abc-token"))  # noqa: S106

    assert repo.users[user.firebase_uid].fcm_token == "abc-token"  # noqa: S105
    assert uow.commit_count == 1


@pytest.mark.asyncio
async def test_update_push_token_clears_when_none():
    repo = FakeUserRepository()
    user = _make_user(fcm_token="existing")  # noqa: S106
    repo.users[user.firebase_uid] = user
    uow = FakeUnitOfWork(users=repo)

    use_case = UpdatePushToken(unit_of_work_factory=lambda: uow)
    await use_case.execute(user, UpdatePushTokenCommand(fcm_token=None))

    assert repo.users[user.firebase_uid].fcm_token is None
    assert uow.commit_count == 1


@pytest.mark.asyncio
async def test_update_push_token_rolls_back_on_error():
    class _ExplodingRepository(FakeUserRepository):
        async def update(self, user: User) -> None:  # noqa: ARG002
            raise RuntimeError("boom")

    repo = _ExplodingRepository()
    user = _make_user()
    repo.users[user.firebase_uid] = user
    uow = FakeUnitOfWork(users=repo)

    use_case = UpdatePushToken(unit_of_work_factory=lambda: uow)
    with pytest.raises(RuntimeError):
        await use_case.execute(user, UpdatePushTokenCommand(fcm_token="boom"))  # noqa: S106

    assert uow.commit_count == 0
    assert uow.rollback_count == 1

"""GetUserSettings UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.use_cases.get_user_settings import (
    GetUserSettings,
    UserSettingsNotFoundError,
)
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
    )
    settings = UserSettings(
        id=uuid4(),
        user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    return user, settings


@pytest.mark.asyncio
async def test_get_user_settings_returns_defaults_when_freshly_created():
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)

    use_case = GetUserSettings(unit_of_work_factory=lambda: FakeUnitOfWork(users=repo))
    view = await use_case.execute(user)

    assert view.input_minutes == 20
    assert view.output_minutes == 5
    assert view.break_minutes == 5
    assert view.notification_enabled is True
    assert view.updated_at == settings.updated_at


@pytest.mark.asyncio
async def test_get_user_settings_raises_when_settings_missing():
    repo = FakeUserRepository()
    user, _ = _make_user_with_settings()
    # users だけ登録し、settings は意図的に未登録にしておく。
    repo.users[user.firebase_uid] = user

    use_case = GetUserSettings(unit_of_work_factory=lambda: FakeUnitOfWork(users=repo))
    with pytest.raises(UserSettingsNotFoundError):
        await use_case.execute(user)

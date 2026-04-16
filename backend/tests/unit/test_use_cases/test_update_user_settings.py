"""UpdateUserSettings UseCase の振る舞い。"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from src.application.dto.user_settings_dto import UpdateUserSettingsCommand
from src.application.use_cases.get_user_settings import UserSettingsNotFoundError
from src.application.use_cases.update_user_settings import UpdateUserSettings
from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.value_objects.auth_provider import AuthProvider
from tests.fakes.fake_user_repository import FakeUserRepository


def _make_user_with_settings() -> tuple[User, UserSettings]:
    # 過去時刻にしておくことで update 後に updated_at が前進したかを判定できる。
    past = datetime.now(UTC) - timedelta(days=1)
    user = User(
        id=uuid4(),
        firebase_uid="uid-001",
        auth_provider=AuthProvider.GOOGLE,
        created_at=past,
        updated_at=past,
    )
    settings = UserSettings(
        id=uuid4(),
        user_id=user.id,
        created_at=past,
        updated_at=past,
    )
    return user, settings


@pytest.mark.asyncio
async def test_update_user_settings_updates_single_field_and_preserves_others():
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)

    use_case = UpdateUserSettings(user_repository=repo)
    view = await use_case.execute(user, UpdateUserSettingsCommand(input_minutes=45))

    assert view.input_minutes == 45
    # 他フィールドはデフォルトのまま保持される
    assert view.output_minutes == 5
    assert view.break_minutes == 5
    assert view.notification_enabled is True
    # 永続化されている
    persisted = repo.settings[user.id]
    assert persisted.input_minutes == 45
    assert persisted.notification_enabled is True


@pytest.mark.asyncio
async def test_update_user_settings_updates_multiple_fields_and_advances_updated_at():
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)
    original_updated_at = settings.updated_at

    use_case = UpdateUserSettings(user_repository=repo)
    view = await use_case.execute(
        user,
        UpdateUserSettingsCommand(
            input_minutes=30,
            output_minutes=10,
            break_minutes=8,
            notification_enabled=False,
        ),
    )

    assert view.input_minutes == 30
    assert view.output_minutes == 10
    assert view.break_minutes == 8
    assert view.notification_enabled is False
    assert view.updated_at > original_updated_at


@pytest.mark.asyncio
async def test_update_user_settings_can_disable_notification_only():
    """notification_enabled=False の単独更新が反映されることを担保する。

    bool は falsy になり得るため `if value:` ではなく `is not None` での判定が必須。
    """
    repo = FakeUserRepository()
    user, settings = _make_user_with_settings()
    await repo.add(user, settings)

    use_case = UpdateUserSettings(user_repository=repo)
    view = await use_case.execute(
        user, UpdateUserSettingsCommand(notification_enabled=False)
    )

    assert view.notification_enabled is False
    assert view.input_minutes == 20  # 他はデフォルトのまま


@pytest.mark.asyncio
async def test_update_user_settings_raises_when_settings_missing():
    repo = FakeUserRepository()
    user, _ = _make_user_with_settings()
    repo.users[user.firebase_uid] = user

    use_case = UpdateUserSettings(user_repository=repo)
    with pytest.raises(UserSettingsNotFoundError):
        await use_case.execute(user, UpdateUserSettingsCommand(input_minutes=30))

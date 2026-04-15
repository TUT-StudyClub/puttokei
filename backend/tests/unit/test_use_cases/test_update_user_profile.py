"""UpdateUserProfile UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.dto.user_dto import UpdateUserProfileCommand
from src.application.use_cases.update_user_profile import UpdateUserProfile
from src.domain.entities.user import User
from src.domain.value_objects.age_group import AgeGroup
from src.domain.value_objects.auth_provider import AuthProvider
from tests.fakes.fake_user_repository import FakeUserRepository


def _make_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid="uid-001",
        auth_provider=AuthProvider.GOOGLE,
        display_name=None,
        age_group=None,
        onboarding_completed=False,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_update_user_profile_sets_onboarding_completed():
    repo = FakeUserRepository()
    user = _make_user()
    # add() は settings も必要だが、update 系 UseCase のテストでは参照しないため省略する。
    repo.users[user.firebase_uid] = user

    use_case = UpdateUserProfile(user_repository=repo)
    dto = await use_case.execute(
        user,
        UpdateUserProfileCommand(display_name="太郎", age_group=AgeGroup.TWENTIES),
    )

    assert dto.age_group is AgeGroup.TWENTIES
    assert dto.display_name == "太郎"
    assert dto.onboarding_completed is True
    assert repo.users[user.firebase_uid].age_group is AgeGroup.TWENTIES
    assert repo.users[user.firebase_uid].onboarding_completed is True

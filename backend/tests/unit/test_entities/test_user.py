"""User entity の振る舞いを検証する。"""

from datetime import UTC, datetime
from uuid import uuid4

from src.domain.entities.user import User
from src.domain.value_objects.age_group import AgeGroup
from src.domain.value_objects.auth_provider import AuthProvider


def _make_user(*, age_group: AgeGroup | None = None, onboarding_completed: bool = False) -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid="uid-001",
        auth_provider=AuthProvider.GOOGLE,
        display_name=None,
        age_group=age_group,
        onboarding_completed=onboarding_completed,
        created_at=now,
        updated_at=now,
    )


def test_with_profile_sets_age_group_and_marks_onboarding_completed():
    user = _make_user()
    new_ts = datetime.now(UTC)

    updated = user.with_profile(
        display_name="太郎",
        age_group=AgeGroup.TWENTIES,
        updated_at=new_ts,
    )

    assert updated.age_group is AgeGroup.TWENTIES
    assert updated.display_name == "太郎"
    assert updated.onboarding_completed is True
    assert updated.updated_at == new_ts


def test_with_profile_clearing_age_group_does_not_revoke_onboarding():
    user = _make_user(age_group=AgeGroup.TWENTIES, onboarding_completed=True)
    new_ts = datetime.now(UTC)

    updated = user.with_profile(
        display_name="花子",
        age_group=None,
        updated_at=new_ts,
    )

    assert updated.age_group is None
    assert updated.display_name == "花子"
    # 既に完了している onboarding を再度未完了にはしない
    assert updated.onboarding_completed is True


def test_with_profile_does_not_mark_onboarding_without_age_group():
    user = _make_user()
    new_ts = datetime.now(UTC)

    updated = user.with_profile(
        display_name="名前のみ",
        age_group=None,
        updated_at=new_ts,
    )

    assert updated.age_group is None
    assert updated.onboarding_completed is False


def test_with_deleted_at_sets_timestamp_and_clears_fcm_token():
    user = _make_user().model_copy(update={"fcm_token": "fcm-xyz"})
    ts = datetime.now(UTC)

    deleted = user.with_deleted_at(deleted_at=ts)

    assert deleted.deleted_at == ts
    assert deleted.fcm_token is None
    # updated_at も削除時刻で上書きされる（論理削除も更新の一種として扱う）
    assert deleted.updated_at == ts


def test_with_deleted_at_preserves_other_fields():
    user = _make_user(age_group=AgeGroup.TWENTIES, onboarding_completed=True).model_copy(
        update={"display_name": "太郎"}
    )
    ts = datetime.now(UTC)

    deleted = user.with_deleted_at(deleted_at=ts)

    assert deleted.id == user.id
    assert deleted.firebase_uid == user.firebase_uid
    assert deleted.auth_provider is user.auth_provider
    assert deleted.display_name == "太郎"
    assert deleted.age_group is AgeGroup.TWENTIES
    assert deleted.onboarding_completed is True
    assert deleted.created_at == user.created_at

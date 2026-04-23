"""User / UserSettings と application DTO の変換。"""

from src.application.dto.user_dto import UserProfileView
from src.application.dto.user_settings_dto import UserSettingsView
from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings


def to_user_profile_view(user: User) -> UserProfileView:
    """domain.User をプロフィール view に変換する。"""
    return UserProfileView(
        id=user.id,
        firebase_uid=user.firebase_uid,
        auth_provider=user.auth_provider,
        display_name=user.display_name,
        age_group=user.age_group,
        onboarding_completed=user.onboarding_completed,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def to_user_settings_view(settings: UserSettings) -> UserSettingsView:
    """domain.UserSettings を設定 view に変換する。"""
    return UserSettingsView(
        input_minutes=settings.input_minutes,
        output_minutes=settings.output_minutes,
        break_minutes=settings.break_minutes,
        notification_enabled=settings.notification_enabled,
        updated_at=settings.updated_at,
    )

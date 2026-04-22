"""PATCH /users/me/profile の UseCase。"""

from datetime import UTC, datetime

from src.application.dto.user_dto import UpdateUserProfileCommand, UserProfileView
from src.domain.entities.user import User
from src.domain.repositories.user_repository import UserRepository


class UpdateUserProfile:
    """User の display_name / age_group を更新する。

    age_group が None 以外で渡された場合は onboarding_completed を True にする。
    """

    def __init__(self, user_repository: UserRepository) -> None:
        self.user_repository = user_repository

    async def execute(
        self, current_user: User, command: UpdateUserProfileCommand
    ) -> UserProfileView:
        updated = current_user.with_profile(
            display_name=command.display_name,
            age_group=command.age_group,
            updated_at=datetime.now(UTC),
        )
        await self.user_repository.update(updated)
        return UserProfileView(
            id=updated.id,
            firebase_uid=updated.firebase_uid,
            auth_provider=updated.auth_provider,
            display_name=updated.display_name,
            age_group=updated.age_group,
            onboarding_completed=updated.onboarding_completed,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
        )

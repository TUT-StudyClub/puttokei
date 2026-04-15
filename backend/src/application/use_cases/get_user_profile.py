"""GET /users/me/profile の UseCase。"""

from src.application.dto.user_dto import UserProfileView
from src.domain.entities.user import User


class GetUserProfile:
    """認証済みユーザ自身のプロフィールをビュー化して返す。"""

    async def execute(self, current_user: User) -> UserProfileView:
        return UserProfileView(
            id=current_user.id,
            firebase_uid=current_user.firebase_uid,
            auth_provider=current_user.auth_provider,
            display_name=current_user.display_name,
            age_group=current_user.age_group,
            onboarding_completed=current_user.onboarding_completed,
            created_at=current_user.created_at,
            updated_at=current_user.updated_at,
        )

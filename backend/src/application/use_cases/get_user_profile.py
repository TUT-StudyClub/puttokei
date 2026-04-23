"""GET /users/me/profile の UseCase。"""

from src.application.dto.user_dto import UserProfileView
from src.application.mappers.user_mapper import to_user_profile_view
from src.domain.entities.user import User


class GetUserProfile:
    """認証済みユーザ自身のプロフィールをビュー化して返す。"""

    async def execute(self, current_user: User) -> UserProfileView:
        return to_user_profile_view(current_user)

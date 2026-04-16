"""GET /users/me/settings の UseCase。"""

from src.application.dto.user_settings_dto import UserSettingsView
from src.domain.entities.user import User
from src.domain.repositories.user_repository import UserRepository


class UserSettingsNotFoundError(Exception):
    """user_settings が存在しない場合に上位層へ知らせるためのドメイン例外。

    通常は auth_middleware がユーザー作成と同時に user_settings を初期化するため
    発生しないが、整合性が崩れた場合に備えて防御的に取り扱う。
    """


class GetUserSettings:
    """認証済みユーザ自身の user_settings をビュー化して返す。"""

    def __init__(self, user_repository: UserRepository) -> None:
        self._user_repository = user_repository

    async def execute(self, current_user: User) -> UserSettingsView:
        settings = await self._user_repository.find_settings_by_user_id(current_user.id)
        if settings is None:
            raise UserSettingsNotFoundError(
                f"user_settings not found for user_id={current_user.id}"
            )
        return UserSettingsView(
            input_minutes=settings.input_minutes,
            output_minutes=settings.output_minutes,
            break_minutes=settings.break_minutes,
            notification_enabled=settings.notification_enabled,
            updated_at=settings.updated_at,
        )

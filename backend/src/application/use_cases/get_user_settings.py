"""GET /users/me/settings の UseCase。"""

from src.application.dto.user_settings_dto import UserSettingsView
from src.application.mappers.user_mapper import to_user_settings_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User


class UserSettingsNotFoundError(Exception):
    """user_settings が存在しない場合に上位層へ知らせるためのドメイン例外。

    通常は AuthenticateUser がユーザー作成と同時に user_settings を初期化するため
    発生しないが、整合性が崩れた場合に備えて防御的に取り扱う。
    """


class GetUserSettings:
    """認証済みユーザ自身の user_settings をビュー化して返す。"""

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(self, current_user: User) -> UserSettingsView:
        async with self.unit_of_work_factory() as uow:
            settings = await uow.users.find_settings_by_user_id(current_user.id)
        if settings is None:
            raise UserSettingsNotFoundError(
                f"user_settings not found for user_id={current_user.id}"
            )
        return to_user_settings_view(settings)

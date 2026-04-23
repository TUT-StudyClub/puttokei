"""PATCH /users/me/settings の UseCase。"""

from datetime import UTC, datetime

from src.application.dto.user_settings_dto import (
    UpdateUserSettingsCommand,
    UserSettingsView,
)
from src.application.mappers.user_mapper import to_user_settings_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.application.use_cases.get_user_settings import UserSettingsNotFoundError
from src.domain.entities.user import User


class UpdateUserSettings:
    """user_settings を部分更新する。None のフィールドは現在値を保持する。"""

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(
        self, current_user: User, command: UpdateUserSettingsCommand
    ) -> UserSettingsView:
        async with self.unit_of_work_factory() as uow:
            current = await uow.users.find_settings_by_user_id(current_user.id)
            if current is None:
                raise UserSettingsNotFoundError(
                    f"user_settings not found for user_id={current_user.id}"
                )

            updated = current.with_updates(
                input_minutes=command.input_minutes,
                output_minutes=command.output_minutes,
                break_minutes=command.break_minutes,
                notification_enabled=command.notification_enabled,
                updated_at=datetime.now(UTC),
            )
            await uow.users.update_settings(updated)
            await uow.commit()
        return to_user_settings_view(updated)

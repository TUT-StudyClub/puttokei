"""PATCH /users/me/settings の UseCase。"""

from datetime import UTC, datetime

from src.application.dto.user_settings_dto import (
    UpdateUserSettingsCommand,
    UserSettingsView,
)
from src.application.use_cases.get_user_settings import UserSettingsNotFoundError
from src.domain.entities.user import User
from src.domain.repositories.user_repository import UserRepository


class UpdateUserSettings:
    """user_settings を部分更新する。None のフィールドは現在値を保持する。"""

    def __init__(self, user_repository: UserRepository) -> None:
        self.user_repository = user_repository

    async def execute(
        self, current_user: User, command: UpdateUserSettingsCommand
    ) -> UserSettingsView:
        current = await self.user_repository.find_settings_by_user_id(current_user.id)
        if current is None:
            raise UserSettingsNotFoundError(
                f"user_settings not found for user_id={current_user.id}"
            )

        update_fields: dict[str, object] = {"updated_at": datetime.now(UTC)}
        if command.input_minutes is not None:
            update_fields["input_minutes"] = command.input_minutes
        if command.output_minutes is not None:
            update_fields["output_minutes"] = command.output_minutes
        if command.break_minutes is not None:
            update_fields["break_minutes"] = command.break_minutes
        if command.notification_enabled is not None:
            update_fields["notification_enabled"] = command.notification_enabled

        updated = current.model_copy(update=update_fields)
        await self.user_repository.update_settings(updated)
        return UserSettingsView(
            input_minutes=updated.input_minutes,
            output_minutes=updated.output_minutes,
            break_minutes=updated.break_minutes,
            notification_enabled=updated.notification_enabled,
            updated_at=updated.updated_at,
        )

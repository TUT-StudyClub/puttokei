"""PUT /users/me/push-token の UseCase。"""

from datetime import UTC, datetime

from src.application.dto.user_dto import UpdatePushTokenCommand
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User


class UpdatePushToken:
    """User の fcm_token を更新する。None で送られた場合はクリアする。"""

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(self, current_user: User, command: UpdatePushTokenCommand) -> None:
        updated = current_user.with_fcm_token(
            fcm_token=command.fcm_token,
            updated_at=datetime.now(UTC),
        )
        async with self.unit_of_work_factory() as uow:
            await uow.users.update(updated)
            await uow.commit()

"""PATCH /users/me/profile の UseCase。"""

from datetime import UTC, datetime

from src.application.dto.user_dto import UpdateUserProfileCommand, UserProfileView
from src.application.mappers.user_mapper import to_user_profile_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User


class UpdateUserProfile:
    """User の display_name / age_group を更新する。

    age_group が None 以外で渡された場合は onboarding_completed を True にする。
    """

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(
        self, current_user: User, command: UpdateUserProfileCommand
    ) -> UserProfileView:
        updated = current_user.with_profile(
            display_name=command.display_name,
            age_group=command.age_group,
            updated_at=datetime.now(UTC),
        )
        async with self.unit_of_work_factory() as uow:
            await uow.users.update(updated)
            await uow.commit()
        return to_user_profile_view(updated)

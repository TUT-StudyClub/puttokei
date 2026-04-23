"""User リポジトリの PostgreSQL 実装。"""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.repositories.user_repository import (
    UserAlreadyExistsError,
    UserRepository,
)
from src.domain.value_objects.age_group import AgeGroup
from src.domain.value_objects.auth_provider import AuthProvider
from src.infrastructure.persistence.models.user_model import UserModel
from src.infrastructure.persistence.models.user_settings_model import UserSettingsModel


class PgUserRepository(UserRepository):
    """PostgreSQL 実装。commit / rollback は Unit of Work が担う。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_firebase_uid(self, firebase_uid: str) -> User | None:
        stmt = select(UserModel).where(
            UserModel.firebase_uid == firebase_uid,
            UserModel.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        row = result.scalar_one_or_none()
        return _to_user(row) if row is not None else None

    async def add(self, user: User, settings: UserSettings) -> None:
        age_group = user.age_group
        age_group_value: str | None = age_group.value if age_group is not None else None
        self._session.add(
            UserModel(
                id=user.id,
                firebase_uid=user.firebase_uid,
                display_name=user.display_name,
                auth_provider=user.auth_provider.value,
                age_group=age_group_value,
                onboarding_completed=user.onboarding_completed,
                fcm_token=user.fcm_token,
                created_at=user.created_at,
                updated_at=user.updated_at,
                deleted_at=user.deleted_at,
            )
        )
        self._session.add(
            UserSettingsModel(
                id=settings.id,
                user_id=settings.user_id,
                input_minutes=settings.input_minutes,
                output_minutes=settings.output_minutes,
                break_minutes=settings.break_minutes,
                notification_enabled=settings.notification_enabled,
                created_at=settings.created_at,
                updated_at=settings.updated_at,
            )
        )
        try:
            await self._session.flush()
        except IntegrityError as exc:
            raise UserAlreadyExistsError(
                f"firebase_uid={user.firebase_uid} already exists"
            ) from exc

    async def update(self, user: User) -> None:
        age_group = user.age_group
        age_group_value: str | None = age_group.value if age_group is not None else None
        stmt = select(UserModel).where(UserModel.id == user.id)
        result = await self._session.execute(stmt)
        model = result.scalar_one()
        model.display_name = user.display_name
        model.age_group = age_group_value
        model.onboarding_completed = user.onboarding_completed
        model.fcm_token = user.fcm_token
        model.updated_at = user.updated_at
        model.deleted_at = user.deleted_at
        await self._session.flush()

    async def find_settings_by_user_id(self, user_id: UUID) -> UserSettings | None:
        stmt = select(UserSettingsModel).where(UserSettingsModel.user_id == user_id)
        result = await self._session.execute(stmt)
        row = result.scalar_one_or_none()
        return _to_settings(row) if row is not None else None

    async def update_settings(self, settings: UserSettings) -> None:
        stmt = select(UserSettingsModel).where(UserSettingsModel.user_id == settings.user_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one()
        model.input_minutes = settings.input_minutes
        model.output_minutes = settings.output_minutes
        model.break_minutes = settings.break_minutes
        model.notification_enabled = settings.notification_enabled
        model.updated_at = settings.updated_at
        await self._session.flush()

    async def delete_by_id(self, user_id: UUID) -> None:
        stmt = delete(UserModel).where(UserModel.id == user_id)
        await self._session.execute(stmt)
        await self._session.flush()


def _to_user(model: UserModel) -> User:
    """ORM モデル → domain.User の変換。"""
    return User(
        id=model.id,
        firebase_uid=model.firebase_uid,
        auth_provider=AuthProvider(model.auth_provider),
        display_name=model.display_name,
        age_group=AgeGroup(model.age_group) if model.age_group is not None else None,
        onboarding_completed=model.onboarding_completed,
        fcm_token=model.fcm_token,
        created_at=model.created_at,
        updated_at=model.updated_at,
        deleted_at=model.deleted_at,
    )


def _to_settings(model: UserSettingsModel) -> UserSettings:
    """ORM モデル → domain.UserSettings の変換。"""
    return UserSettings(
        id=model.id,
        user_id=model.user_id,
        input_minutes=model.input_minutes,
        output_minutes=model.output_minutes,
        break_minutes=model.break_minutes,
        notification_enabled=model.notification_enabled,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )

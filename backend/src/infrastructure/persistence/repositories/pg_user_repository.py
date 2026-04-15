"""User リポジトリの PostgreSQL 実装。

AsyncSession を外部から渡して扱う。現実装では 1 リクエスト 1 セッションを前提に、
`Database.session()` で取り出したものを呼び出し側で commit / rollback する。
"""

from sqlalchemy import select

from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.repositories.user_repository import UserRepository
from src.domain.value_objects.age_group import AgeGroup
from src.domain.value_objects.auth_provider import AuthProvider
from src.infrastructure.persistence.database import Database
from src.infrastructure.persistence.models.user_model import UserModel
from src.infrastructure.persistence.models.user_settings_model import UserSettingsModel


class PgUserRepository(UserRepository):
    """PostgreSQL 実装。`Database` から都度セッションを開いて操作する。"""

    def __init__(self, database: Database) -> None:
        self._database = database

    async def find_by_firebase_uid(self, firebase_uid: str) -> User | None:
        async with self._database.session() as session:
            stmt = select(UserModel).where(UserModel.firebase_uid == firebase_uid)
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            return _to_user(row) if row is not None else None

    async def add(self, user: User, settings: UserSettings) -> None:
        age_group = user.age_group
        age_group_value: str | None = age_group.value if age_group is not None else None
        async with self._database.session() as session:
            session.add(
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
            session.add(
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
            await session.commit()

    async def update(self, user: User) -> None:
        age_group = user.age_group
        age_group_value: str | None = age_group.value if age_group is not None else None
        async with self._database.session() as session:
            stmt = select(UserModel).where(UserModel.id == user.id)
            result = await session.execute(stmt)
            model = result.scalar_one()
            model.display_name = user.display_name
            model.age_group = age_group_value
            model.onboarding_completed = user.onboarding_completed
            model.fcm_token = user.fcm_token
            model.updated_at = user.updated_at
            model.deleted_at = user.deleted_at
            await session.commit()


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

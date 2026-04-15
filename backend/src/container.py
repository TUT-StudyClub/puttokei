"""DI 組み立てのエントリ（Composition Root）。

後続 Epic でリポジトリ / サービスの実装を差し込む。
presentation からは `request.app.state.container` 経由で参照する。
"""

from pydantic import BaseModel, ConfigDict

from src.application.use_cases.get_user_profile import GetUserProfile
from src.application.use_cases.update_user_profile import UpdateUserProfile
from src.config import Settings
from src.domain.repositories.user_repository import UserRepository
from src.domain.services.auth_verifier import AuthVerifier
from src.infrastructure.auth.firebase_auth import FirebaseAuthVerifier
from src.infrastructure.persistence.database import Database
from src.infrastructure.persistence.repositories.pg_user_repository import PgUserRepository


class Container(BaseModel):
    """アプリ全体で共有する依存物。

    Database など非 Pydantic 型を含むため arbitrary_types_allowed を有効化する。
    """

    model_config = ConfigDict(arbitrary_types_allowed=True, frozen=True)

    settings: Settings
    database: Database
    auth_verifier: AuthVerifier
    user_repository: UserRepository
    get_user_profile: GetUserProfile
    update_user_profile: UpdateUserProfile


def build_container(settings: Settings) -> Container:
    """Settings から Container を組み立てる。"""
    database = Database(database_url=settings.database_url)
    auth_verifier: AuthVerifier = FirebaseAuthVerifier(settings=settings)
    user_repository: UserRepository = PgUserRepository(database=database)
    get_user_profile = GetUserProfile()
    update_user_profile = UpdateUserProfile(user_repository=user_repository)
    return Container(
        settings=settings,
        database=database,
        auth_verifier=auth_verifier,
        user_repository=user_repository,
        get_user_profile=get_user_profile,
        update_user_profile=update_user_profile,
    )

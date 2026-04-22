"""DI 組み立てのエントリ（Composition Root）。

後続 Epic でリポジトリ / サービスの実装を差し込む。
presentation からは `request.app.state.container` 経由で参照する。
"""

from functools import cache

from pydantic import BaseModel, ConfigDict

from src.application.use_cases.create_session import CreateSession
from src.application.use_cases.delete_account import DeleteAccount
from src.application.use_cases.get_judgment import GetJudgment
from src.application.use_cases.get_user_profile import GetUserProfile
from src.application.use_cases.get_user_settings import GetUserSettings
from src.application.use_cases.submit_output import SubmitOutput
from src.application.use_cases.update_session_status import UpdateSessionStatus
from src.application.use_cases.update_user_profile import UpdateUserProfile
from src.application.use_cases.update_user_settings import UpdateUserSettings
from src.config import Settings
from src.domain.repositories.judgment_repository import JudgmentRepository
from src.domain.repositories.output_repository import OutputRepository
from src.domain.repositories.session_repository import SessionRepository
from src.domain.repositories.user_repository import UserRepository
from src.domain.services.auth_verifier import AuthVerifier
from src.domain.services.llm_judge_service import LLMProvider
from src.infrastructure.auth.firebase_auth import FirebaseAuthVerifier
from src.infrastructure.persistence.database import Database
from src.infrastructure.persistence.repositories.pg_judgment_repository import (
    PgJudgmentRepository,
)
from src.infrastructure.persistence.repositories.pg_output_repository import PgOutputRepository
from src.infrastructure.persistence.repositories.pg_session_repository import (
    PgSessionRepository,
)
from src.infrastructure.persistence.repositories.pg_user_repository import PgUserRepository


@cache
def get_llm_provider() -> LLMProvider:
    """LLM provider を遅延初期化し、プロセス内で共有する。"""

    from src.config import LLMSettings
    from src.infrastructure.llm.gemini_provider import GeminiProvider

    settings = LLMSettings()
    return GeminiProvider.from_settings(settings)


class Container(BaseModel):
    """アプリ全体で共有する依存物。

    Database など非 Pydantic 型を含むため arbitrary_types_allowed を有効化する。
    """

    model_config = ConfigDict(arbitrary_types_allowed=True, frozen=True)

    settings: Settings
    database: Database
    auth_verifier: AuthVerifier
    user_repository: UserRepository
    session_repository: SessionRepository
    output_repository: OutputRepository
    judgment_repository: JudgmentRepository
    get_user_profile: GetUserProfile
    update_user_profile: UpdateUserProfile
    get_user_settings: GetUserSettings
    update_user_settings: UpdateUserSettings
    delete_account: DeleteAccount
    create_session: CreateSession
    update_session_status: UpdateSessionStatus
    submit_output: SubmitOutput
    get_judgment: GetJudgment


def build_container(settings: Settings) -> Container:
    """Settings から Container を組み立てる。"""
    database = Database(database_url=settings.database_url)
    auth_verifier: AuthVerifier = FirebaseAuthVerifier(settings=settings)
    user_repository: UserRepository = PgUserRepository(database=database)
    session_repository: SessionRepository = PgSessionRepository(database=database)
    output_repository: OutputRepository = PgOutputRepository(database=database)
    judgment_repository: JudgmentRepository = PgJudgmentRepository(database=database)
    get_user_profile = GetUserProfile()
    update_user_profile = UpdateUserProfile(user_repository=user_repository)
    get_user_settings = GetUserSettings(user_repository=user_repository)
    update_user_settings = UpdateUserSettings(user_repository=user_repository)
    delete_account = DeleteAccount(user_repository=user_repository)
    create_session = CreateSession(session_repository=session_repository)
    update_session_status = UpdateSessionStatus(session_repository=session_repository)
    submit_output = SubmitOutput(
        session_repository=session_repository,
        output_repository=output_repository,
    )
    get_judgment = GetJudgment(
        session_repository=session_repository,
        output_repository=output_repository,
        judgment_repository=judgment_repository,
    )
    return Container(
        settings=settings,
        database=database,
        auth_verifier=auth_verifier,
        user_repository=user_repository,
        session_repository=session_repository,
        output_repository=output_repository,
        judgment_repository=judgment_repository,
        get_user_profile=get_user_profile,
        update_user_profile=update_user_profile,
        get_user_settings=get_user_settings,
        update_user_settings=update_user_settings,
        delete_account=delete_account,
        create_session=create_session,
        update_session_status=update_session_status,
        submit_output=submit_output,
        get_judgment=get_judgment,
    )

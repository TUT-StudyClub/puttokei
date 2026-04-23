"""DI 組み立てのエントリ（Composition Root）。"""

from functools import cache

from pydantic import BaseModel, ConfigDict

from src.application.use_cases.authenticate_user import AuthenticateUser
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
from src.domain.services.llm_judge_service import LLMProvider
from src.infrastructure.auth.firebase_auth import FirebaseAuthVerifier
from src.infrastructure.persistence.database import Database
from src.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork


@cache
def get_llm_provider() -> LLMProvider:
    """LLM provider を遅延初期化し、プロセス内で共有する。"""

    from src.config import LLMSettings
    from src.infrastructure.llm.gemini_provider import Client, GeminiProvider

    settings = LLMSettings()
    return GeminiProvider(
        client=Client(api_key=settings.gemini_api_key),
        model=settings.gemini_model,
        thinking_level=settings.gemini_thinking_level,
        temperature=settings.gemini_temperature,
        timeout_seconds=settings.timeout_seconds,
    )


class Container(BaseModel):
    """アプリ全体で共有する依存物。"""

    model_config = ConfigDict(arbitrary_types_allowed=True, frozen=True)

    settings: Settings
    database: Database
    authenticate_user: AuthenticateUser
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

    def unit_of_work_factory() -> SqlAlchemyUnitOfWork:
        return SqlAlchemyUnitOfWork(database=database)

    return Container(
        settings=settings,
        database=database,
        authenticate_user=AuthenticateUser(
            auth_verifier=FirebaseAuthVerifier(settings=settings),
            unit_of_work_factory=unit_of_work_factory,
        ),
        get_user_profile=GetUserProfile(),
        update_user_profile=UpdateUserProfile(unit_of_work_factory=unit_of_work_factory),
        get_user_settings=GetUserSettings(unit_of_work_factory=unit_of_work_factory),
        update_user_settings=UpdateUserSettings(unit_of_work_factory=unit_of_work_factory),
        delete_account=DeleteAccount(unit_of_work_factory=unit_of_work_factory),
        create_session=CreateSession(unit_of_work_factory=unit_of_work_factory),
        update_session_status=UpdateSessionStatus(unit_of_work_factory=unit_of_work_factory),
        submit_output=SubmitOutput(unit_of_work_factory=unit_of_work_factory),
        get_judgment=GetJudgment(unit_of_work_factory=unit_of_work_factory),
    )

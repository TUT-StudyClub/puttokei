"""DI 組み立てのエントリ（Composition Root）。"""

from pydantic import BaseModel, ConfigDict

from src.application.use_cases.authenticate_user import AuthenticateUser
from src.application.use_cases.create_session import CreateSession
from src.application.use_cases.delete_account import DeleteAccount
from src.application.use_cases.get_judgment import GetJudgment
from src.application.use_cases.get_judgment_progress import GetJudgmentProgress
from src.application.use_cases.get_user_profile import GetUserProfile
from src.application.use_cases.get_user_settings import GetUserSettings
from src.application.use_cases.get_weekly_report import GetWeeklyReport
from src.application.use_cases.list_today_outputs import ListTodayOutputs
from src.application.use_cases.run_local_judgment import RunLocalJudgment
from src.application.use_cases.submit_output import SubmitOutput
from src.application.use_cases.update_push_token import UpdatePushToken
from src.application.use_cases.update_session_status import UpdateSessionStatus
from src.application.use_cases.update_user_profile import UpdateUserProfile
from src.application.use_cases.update_user_settings import UpdateUserSettings
from src.config import Settings
from src.domain.services.notification_service import NotificationService
from src.infrastructure.auth.firebase_auth import FirebaseAuthVerifier
from src.infrastructure.llm.factory import build_llm_judge_service
from src.infrastructure.notification.fcm_notification import FcmNotificationService
from src.infrastructure.persistence.database import Database
from src.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork


class Container(BaseModel):
    """アプリ全体で共有する依存物。"""

    model_config = ConfigDict(arbitrary_types_allowed=True, frozen=True)

    settings: Settings
    database: Database
    notification_service: NotificationService
    authenticate_user: AuthenticateUser
    get_user_profile: GetUserProfile
    update_user_profile: UpdateUserProfile
    update_push_token: UpdatePushToken
    get_user_settings: GetUserSettings
    update_user_settings: UpdateUserSettings
    delete_account: DeleteAccount
    create_session: CreateSession
    update_session_status: UpdateSessionStatus
    submit_output: SubmitOutput
    # `local_judgment_enabled=False` の環境（= production など）では未注入。
    # 未注入時は router 側で BackgroundTasks 登録をスキップし、
    # Cloud Tasks 実装（Epic #4）に処理を委ねる前提。
    run_local_judgment: RunLocalJudgment | None
    get_judgment: GetJudgment
    get_judgment_progress: GetJudgmentProgress
    list_today_outputs: ListTodayOutputs
    get_weekly_report: GetWeeklyReport


def build_container(settings: Settings) -> Container:
    """Settings から Container を組み立てる。"""
    database = Database(database_url=settings.database_url)

    def unit_of_work_factory() -> SqlAlchemyUnitOfWork:
        return SqlAlchemyUnitOfWork(database=database)

    local_judgment_enabled = settings.local_judgment_enabled or settings.app_env == "development"
    run_local_judgment: RunLocalJudgment | None = None
    if local_judgment_enabled:
        judge_service = build_llm_judge_service(settings)
        run_local_judgment = RunLocalJudgment(
            unit_of_work_factory=unit_of_work_factory,
            judge_service=judge_service,
        )

    return Container(
        settings=settings,
        database=database,
        notification_service=FcmNotificationService(settings=settings),
        authenticate_user=AuthenticateUser(
            auth_verifier=FirebaseAuthVerifier(settings=settings),
            unit_of_work_factory=unit_of_work_factory,
        ),
        get_user_profile=GetUserProfile(),
        update_user_profile=UpdateUserProfile(unit_of_work_factory=unit_of_work_factory),
        update_push_token=UpdatePushToken(unit_of_work_factory=unit_of_work_factory),
        get_user_settings=GetUserSettings(unit_of_work_factory=unit_of_work_factory),
        update_user_settings=UpdateUserSettings(unit_of_work_factory=unit_of_work_factory),
        delete_account=DeleteAccount(unit_of_work_factory=unit_of_work_factory),
        create_session=CreateSession(unit_of_work_factory=unit_of_work_factory),
        update_session_status=UpdateSessionStatus(unit_of_work_factory=unit_of_work_factory),
        submit_output=SubmitOutput(unit_of_work_factory=unit_of_work_factory),
        run_local_judgment=run_local_judgment,
        get_judgment=GetJudgment(unit_of_work_factory=unit_of_work_factory),
        get_judgment_progress=GetJudgmentProgress(unit_of_work_factory=unit_of_work_factory),
        list_today_outputs=ListTodayOutputs(unit_of_work_factory=unit_of_work_factory),
        get_weekly_report=GetWeeklyReport(unit_of_work_factory=unit_of_work_factory),
    )

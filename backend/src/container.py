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
from src.application.use_cases.issue_output_image_upload_url import (
    IssueOutputImageUploadUrl,
)
from src.application.use_cases.list_today_outputs import ListTodayOutputs
from src.application.use_cases.run_image_judgment import RunImageJudgment
from src.application.use_cases.run_text_judgment import RunTextJudgment
from src.application.use_cases.submit_image_output import SubmitImageOutput
from src.application.use_cases.submit_text_output import SubmitTextOutput
from src.application.use_cases.update_session_status import UpdateSessionStatus
from src.application.use_cases.update_user_profile import UpdateUserProfile
from src.application.use_cases.update_user_settings import UpdateUserSettings
from src.config import Settings
from src.domain.services.output_image_storage import OutputImageStorage
from src.infrastructure.auth.firebase_auth import FirebaseAuthVerifier
from src.infrastructure.llm.factory import build_llm_judge_service
from src.infrastructure.persistence.database import Database
from src.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from src.infrastructure.storage.gcs_output_image_storage import GcsOutputImageStorage


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
    submit_text_output: SubmitTextOutput
    submit_image_output: SubmitImageOutput
    # 画像アップロード URL 発行は GCS 設定が無いと提供できない。
    issue_output_image_upload_url: IssueOutputImageUploadUrl | None
    # `local_judgment_enabled=False` の環境では未注入。
    # 未注入時は router 側で BackgroundTasks 登録をスキップし、
    # Cloud Tasks 実装に処理を委ねる前提。
    run_text_judgment: RunTextJudgment | None
    run_image_judgment: RunImageJudgment | None
    get_judgment: GetJudgment
    get_judgment_progress: GetJudgmentProgress
    list_today_outputs: ListTodayOutputs
    get_weekly_report: GetWeeklyReport


def build_container(settings: Settings) -> Container:
    """Settings から Container を組み立てる。"""
    database = Database(database_url=settings.database_url)

    def unit_of_work_factory() -> SqlAlchemyUnitOfWork:
        return SqlAlchemyUnitOfWork(database=database)

    image_storage: OutputImageStorage | None = None
    if settings.gcs_output_image_bucket:
        image_storage = GcsOutputImageStorage(
            project_id=settings.gcs_project_id,
            bucket_name=settings.gcs_output_image_bucket,
        )

    issue_output_image_upload_url: IssueOutputImageUploadUrl | None = None
    if image_storage is not None:
        issue_output_image_upload_url = IssueOutputImageUploadUrl(
            unit_of_work_factory=unit_of_work_factory,
            storage=image_storage,
            allowed_mime_types=settings.output_image_allowed_mime_types,
            upload_url_ttl_seconds=settings.gcs_signed_upload_url_ttl_seconds,
        )

    local_judgment_enabled = settings.local_judgment_enabled or settings.app_env == "development"
    run_text_judgment: RunTextJudgment | None = None
    run_image_judgment: RunImageJudgment | None = None
    if local_judgment_enabled:
        judge_service = build_llm_judge_service(settings)
        run_text_judgment = RunTextJudgment(
            unit_of_work_factory=unit_of_work_factory,
            judge_service=judge_service,
        )
        if image_storage is not None:
            run_image_judgment = RunImageJudgment(
                unit_of_work_factory=unit_of_work_factory,
                judge_service=judge_service,
                storage=image_storage,
            )

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
        submit_text_output=SubmitTextOutput(unit_of_work_factory=unit_of_work_factory),
        submit_image_output=SubmitImageOutput(unit_of_work_factory=unit_of_work_factory),
        issue_output_image_upload_url=issue_output_image_upload_url,
        run_text_judgment=run_text_judgment,
        run_image_judgment=run_image_judgment,
        get_judgment=GetJudgment(unit_of_work_factory=unit_of_work_factory),
        get_judgment_progress=GetJudgmentProgress(unit_of_work_factory=unit_of_work_factory),
        list_today_outputs=ListTodayOutputs(
            unit_of_work_factory=unit_of_work_factory,
            image_storage=image_storage,
            download_url_ttl_seconds=settings.gcs_signed_download_url_ttl_seconds,
        ),
        get_weekly_report=GetWeeklyReport(
            unit_of_work_factory=unit_of_work_factory,
            image_storage=image_storage,
            download_url_ttl_seconds=settings.gcs_signed_download_url_ttl_seconds,
        ),
    )

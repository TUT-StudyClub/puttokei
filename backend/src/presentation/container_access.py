"""presentation 層から app.state.container を型付きで取得するヘルパ。"""

from abc import ABC, abstractmethod
from typing import cast

from fastapi import Request

from src.application.use_cases.authenticate_user import AuthenticateUser
from src.application.use_cases.create_session import CreateSession
from src.application.use_cases.delete_account import DeleteAccount
from src.application.use_cases.get_daily_report import GetDailyReport
from src.application.use_cases.get_judgment import GetJudgment
from src.application.use_cases.get_judgment_detail import GetJudgmentDetail
from src.application.use_cases.get_judgment_progress import GetJudgmentProgress
from src.application.use_cases.get_stats import GetStatsPeriod, GetStatsSummary
from src.application.use_cases.get_user_profile import GetUserProfile
from src.application.use_cases.get_user_settings import GetUserSettings
from src.application.use_cases.get_weekly_report import GetWeeklyReport
from src.application.use_cases.issue_output_image_upload_url import (
    IssueOutputImageUploadUrl,
)
from src.application.use_cases.list_judgments import ListJudgments
from src.application.use_cases.list_today_outputs import ListTodayOutputs
from src.application.use_cases.run_image_judgment import RunImageJudgment
from src.application.use_cases.run_text_judgment import RunTextJudgment
from src.application.use_cases.submit_image_output import SubmitImageOutput
from src.application.use_cases.submit_text_output import SubmitTextOutput
from src.application.use_cases.update_output_subject import UpdateOutputSubject
from src.application.use_cases.update_push_token import UpdatePushToken
from src.application.use_cases.update_session_status import UpdateSessionStatus
from src.application.use_cases.update_user_profile import UpdateUserProfile
from src.application.use_cases.update_user_settings import UpdateUserSettings


class PingableDatabase(ABC):
    """ヘルスチェックで必要な最小限の DB インタフェース。"""

    @abstractmethod
    async def ping(self) -> bool:
        """接続確認を返す。"""


class PresentationContainer(ABC):
    """presentation 層から参照する依存物だけを切り出した型。"""

    database: PingableDatabase
    authenticate_user: AuthenticateUser
    get_user_profile: GetUserProfile
    update_user_profile: UpdateUserProfile
    update_push_token: UpdatePushToken
    get_user_settings: GetUserSettings
    update_user_settings: UpdateUserSettings
    delete_account: DeleteAccount
    create_session: CreateSession
    update_session_status: UpdateSessionStatus
    submit_text_output: SubmitTextOutput
    submit_image_output: SubmitImageOutput
    update_output_subject: UpdateOutputSubject
    issue_output_image_upload_url: IssueOutputImageUploadUrl | None
    run_text_judgment: RunTextJudgment | None
    run_image_judgment: RunImageJudgment | None
    get_judgment: GetJudgment
    get_judgment_detail: GetJudgmentDetail
    get_judgment_progress: GetJudgmentProgress
    list_judgments: ListJudgments
    list_today_outputs: ListTodayOutputs
    get_stats_summary: GetStatsSummary
    get_stats_period: GetStatsPeriod
    get_weekly_report: GetWeeklyReport
    get_daily_report: GetDailyReport


def get_presentation_container(request: Request) -> PresentationContainer:
    """app.state.container を presentation 用の ABC として返す。"""
    return cast(PresentationContainer, request.app.state.container)

"""presentation 層から app.state.container を型付きで取得するヘルパ。"""

from abc import ABC, abstractmethod
from typing import cast

from fastapi import Request

from src.application.use_cases.authenticate_user import AuthenticateUser
from src.application.use_cases.create_session import CreateSession
from src.application.use_cases.delete_account import DeleteAccount
from src.application.use_cases.get_judgment import GetJudgment
from src.application.use_cases.get_user_profile import GetUserProfile
from src.application.use_cases.get_user_settings import GetUserSettings
from src.application.use_cases.get_weekly_report import GetWeeklyReport
from src.application.use_cases.list_today_outputs import ListTodayOutputs
from src.application.use_cases.run_local_judgment import RunLocalJudgment
from src.application.use_cases.submit_output import SubmitOutput
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
    get_user_settings: GetUserSettings
    update_user_settings: UpdateUserSettings
    delete_account: DeleteAccount
    create_session: CreateSession
    update_session_status: UpdateSessionStatus
    submit_output: SubmitOutput
    run_local_judgment: RunLocalJudgment | None
    get_judgment: GetJudgment
    list_today_outputs: ListTodayOutputs
    get_weekly_report: GetWeeklyReport


def get_presentation_container(request: Request) -> PresentationContainer:
    """app.state.container を presentation 用の ABC として返す。"""
    return cast(PresentationContainer, request.app.state.container)

"""presentation 層から app.state.container を型付きで取得するヘルパ。"""

from abc import ABC, abstractmethod
from typing import cast

from fastapi import Request

from src.application.use_cases.create_session import CreateSession
from src.application.use_cases.get_user_profile import GetUserProfile
from src.application.use_cases.update_session_status import UpdateSessionStatus
from src.application.use_cases.update_user_profile import UpdateUserProfile
from src.domain.repositories.user_repository import UserRepository
from src.domain.services.auth_verifier import AuthVerifier


class PingableDatabase(ABC):
    """ヘルスチェックで必要な最小限の DB インタフェース。"""

    @abstractmethod
    async def ping(self) -> bool:
        """接続確認を返す。"""


class PresentationContainer(ABC):
    """presentation 層から参照する依存物だけを切り出した型。"""

    database: PingableDatabase
    auth_verifier: AuthVerifier
    user_repository: UserRepository
    get_user_profile: GetUserProfile
    update_user_profile: UpdateUserProfile
    create_session: CreateSession
    update_session_status: UpdateSessionStatus


def get_presentation_container(request: Request) -> PresentationContainer:
    """app.state.container を presentation 用の ABC として返す。"""
    return cast(PresentationContainer, request.app.state.container)

"""Bearer token から認証済み User を解決する use case。"""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.repositories.user_repository import UserAlreadyExistsError
from src.domain.services.auth_verifier import (
    AuthVerifier,
    InvalidTokenError,
    VerifiedToken,
)
from src.domain.value_objects.auth_provider import AuthProvider


class InvalidAuthenticationTokenError(Exception):
    """認証 token が無効、期限切れ、または形式不正。"""


class DeletedAccountAuthenticationError(Exception):
    """論理削除済みアカウントが同じ Firebase UID でアクセスしている。"""


@dataclass(frozen=True, slots=True)
class AuthenticateUserResult:
    """token 検証結果。

    `/auth/verify` が `is_new` を要求するため、User 単体ではなく初回登録フラグ付きで返す。
    """

    user: User
    is_new: bool


class AuthenticateUser:
    """token 検証と未登録ユーザーの初期作成を application 層で実行する。"""

    def __init__(
        self,
        *,
        auth_verifier: AuthVerifier,
        unit_of_work_factory: UnitOfWorkFactory,
    ) -> None:
        self.auth_verifier = auth_verifier
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(self, token: str) -> AuthenticateUserResult:
        try:
            verified = self.auth_verifier.verify_id_token(token)
        except InvalidTokenError as exc:
            raise InvalidAuthenticationTokenError("invalid authentication token") from exc

        async with self.unit_of_work_factory() as uow:
            existing = await uow.users.find_by_firebase_uid(verified["uid"])
            if existing is not None:
                return AuthenticateUserResult(user=existing, is_new=False)

            user, settings = _build_initial_user(verified)
            try:
                await uow.users.add(user, settings)
            except UserAlreadyExistsError as exc:
                raise DeletedAccountAuthenticationError("account has been deleted") from exc
            await uow.commit()
            return AuthenticateUserResult(user=user, is_new=True)


def _build_initial_user(verified: VerifiedToken) -> tuple[User, UserSettings]:
    now = datetime.now(UTC)
    user = User(
        id=uuid4(),
        firebase_uid=verified["uid"],
        auth_provider=_to_auth_provider(verified["sign_in_provider"]),
        display_name=None,
        age_group=None,
        onboarding_completed=False,
        fcm_token=None,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    settings = UserSettings(
        id=uuid4(),
        user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    return user, settings


def _to_auth_provider(sign_in_provider: str) -> AuthProvider:
    if sign_in_provider.startswith("apple"):
        return AuthProvider.APPLE
    return AuthProvider.GOOGLE

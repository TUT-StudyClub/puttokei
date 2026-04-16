"""認証 middleware（Firebase ID Token 検証 + current user 解決）。

要件書 6.2 の dependency パターンに従い、Authorization: Bearer <token> を検証し、
users / user_settings を自動作成してから domain.User を返す。
未登録ユーザは初期化済み状態（onboarding_completed=False, age_group=None）で作成する。
"""

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings
from src.domain.services.auth_verifier import (
    AuthVerifier,
    InvalidTokenError,
    VerifiedToken,
)
from src.domain.value_objects.auth_provider import AuthProvider
from src.presentation.container_access import (
    PresentationContainer,
    get_presentation_container,
)
from src.presentation.problem_details import ProblemDetailsError

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),  # noqa: B008
) -> User:
    """Authorization ヘッダを検証し、対応する内部ユーザを返す。"""
    if credentials is None or not credentials.credentials:
        raise ProblemDetailsError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            problem_type="authentication_required",
            title="Authentication Required",
            detail="認証トークンが指定されていません。",
            headers={"WWW-Authenticate": "Bearer"},
        )

    container = get_presentation_container(request)
    verifier: AuthVerifier = container.auth_verifier
    try:
        verified = verifier.verify_id_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            problem_type="authentication_error",
            title="Authentication Error",
            detail="認証トークンが無効です。",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    existing = await container.user_repository.find_by_firebase_uid(verified["uid"])
    if existing is not None:
        return existing
    return await _auto_create_user(container, verified)


async def _auto_create_user(container: PresentationContainer, verified: VerifiedToken) -> User:
    """未登録ユーザを users + user_settings 付きで作成して返す。"""
    now = datetime.now(UTC)
    provider = _to_auth_provider(verified["sign_in_provider"])
    user = User(
        id=uuid4(),
        firebase_uid=verified["uid"],
        auth_provider=provider,
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
    await container.user_repository.add(user, settings)
    return user


def _to_auth_provider(sign_in_provider: str) -> AuthProvider:
    """Firebase の sign_in_provider 値を AuthProvider に写像する。"""
    if sign_in_provider.startswith("apple"):
        return AuthProvider.APPLE
    return AuthProvider.GOOGLE

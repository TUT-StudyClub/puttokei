"""認証エンドポイント。

要件書 3.2.1 / 6.1 に対応する `/api/v1/auth/verify` を提供する。
クライアントが Firebase ID Token を送ると、Firebase Admin で検証し、未登録の
UID であればアプリ内 users を初期作成したうえで `user` と `is_new` を返す。
"""

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.application.mappers.user_mapper import to_user_profile_view
from src.application.use_cases.authenticate_user import (
    DeletedAccountAuthenticationError,
    InvalidAuthenticationTokenError,
)
from src.presentation.container_access import get_presentation_container
from src.presentation.mappers.response_mapper import to_user_profile_response
from src.presentation.problem_details import ProblemDetailsError
from src.presentation.schemas.auth_schema import VerifyAuthResponse

bearer_scheme = HTTPBearer(auto_error=False)

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/verify", response_model=VerifyAuthResponse)
async def verify_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),  # noqa: B008
) -> VerifyAuthResponse:
    """Firebase ID Token を検証し、ユーザープロフィールと初回登録フラグを返す。

    `is_new` は新規作成時に true、既存ユーザー取得時に false。
    トークン未指定 / 無効 / 削除済みアカウントは 401 problem+json で応答する。
    """
    if credentials is None or not credentials.credentials:
        raise ProblemDetailsError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            problem_type="authentication_required",
            title="Authentication Required",
            detail="認証トークンが指定されていません。",
            headers={"WWW-Authenticate": "Bearer"},
        )

    container = get_presentation_container(request)
    try:
        result = await container.authenticate_user.execute(credentials.credentials)
    except InvalidAuthenticationTokenError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            problem_type="authentication_error",
            title="Authentication Error",
            detail="認証トークンが無効です。",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except DeletedAccountAuthenticationError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            problem_type="authentication_required",
            title="Authentication Required",
            detail="このアカウントは削除されています。",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return VerifyAuthResponse(
        user=to_user_profile_response(to_user_profile_view(result.user)),
        is_new=result.is_new,
    )

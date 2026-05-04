"""認証 dependency（Bearer token 抽出 + current user 解決）。"""

from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.application.use_cases.authenticate_user import (
    DeletedAccountAuthenticationError,
    InvalidAuthenticationTokenError,
    UnsupportedSignInProviderError,
)
from src.domain.entities.user import User
from src.presentation.container_access import get_presentation_container
from src.presentation.problem_details import ProblemDetailsError

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),  # noqa: B008
) -> User:
    """Authorization ヘッダを取り出し、use case 経由で内部ユーザーを返す。"""
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
    except UnsupportedSignInProviderError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            problem_type="unsupported_sign_in_provider",
            title="Unsupported Sign-in Provider",
            detail="このサインイン方式は現在サポートしていません。",
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
    return result.user

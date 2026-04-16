"""ユーザーエンドポイント。

要件書 3.2.6 のうち、
- `GET/PATCH /api/v1/users/me/profile`: プロフィール取得・更新
- `GET/PATCH /api/v1/users/me/settings`: タイマー / 通知設定の取得・更新
- `DELETE /api/v1/users/me`: アカウント削除（FK ondelete=CASCADE で関連レコードも削除される）
を提供する。Firebase Auth 上のアカウント削除はクライアント側 (signOut) の責務。
"""

from fastapi import APIRouter, Depends, Request, Response, status

from src.application.dto.user_dto import UpdateUserProfileCommand, UserProfileView
from src.application.dto.user_settings_dto import (
    UpdateUserSettingsCommand,
    UserSettingsView,
)
from src.application.use_cases.get_user_settings import UserSettingsNotFoundError
from src.domain.entities.user import User
from src.presentation.container_access import get_presentation_container
from src.presentation.middleware.auth_middleware import get_current_user
from src.presentation.problem_details import ProblemDetailsError
from src.presentation.schemas.user_schema import (
    UpdateUserProfileRequest,
    UserProfileResponse,
)
from src.presentation.schemas.user_settings_schema import (
    UpdateUserSettingsRequest,
    UserSettingsResponse,
)

users_router = APIRouter(prefix="/users", tags=["users"])


@users_router.get("/me/profile", response_model=UserProfileResponse)
async def get_my_profile(
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> UserProfileResponse:
    """自分のプロフィールを取得する。未オンボーディング時は onboarding_completed=false。"""
    container = get_presentation_container(request)
    dto = await container.get_user_profile.execute(current_user)
    return _to_profile_response(dto)


@users_router.patch("/me/profile", response_model=UserProfileResponse)
async def update_my_profile(
    body: UpdateUserProfileRequest,
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> UserProfileResponse:
    """プロフィールを更新する。age_group がセットされると onboarding_completed=true になる。"""
    container = get_presentation_container(request)
    command = UpdateUserProfileCommand(
        display_name=body.display_name,
        age_group=body.age_group,
    )
    dto = await container.update_user_profile.execute(current_user, command)
    return _to_profile_response(dto)


@users_router.get("/me/settings", response_model=UserSettingsResponse)
async def get_my_settings(
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> UserSettingsResponse:
    """ユーザーのタイマー / 通知設定を取得する。"""
    container = get_presentation_container(request)
    try:
        view = await container.get_user_settings.execute(current_user)
    except UserSettingsNotFoundError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_404_NOT_FOUND,
            problem_type="user_settings_not_found",
            title="User Settings Not Found",
            detail="ユーザー設定が見つかりません。",
        ) from exc
    return _to_settings_response(view)


@users_router.patch("/me/settings", response_model=UserSettingsResponse)
async def update_my_settings(
    body: UpdateUserSettingsRequest,
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> UserSettingsResponse:
    """ユーザーのタイマー / 通知設定を部分更新する。空 body は 422 で蹴る。"""
    if body.is_empty():
        raise ProblemDetailsError(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            problem_type="validation_error",
            title="Validation Error",
            detail="少なくとも 1 つのフィールドを指定してください。",
        )
    container = get_presentation_container(request)
    command = UpdateUserSettingsCommand(
        input_minutes=body.input_minutes,
        output_minutes=body.output_minutes,
        break_minutes=body.break_minutes,
        notification_enabled=body.notification_enabled,
    )
    try:
        view = await container.update_user_settings.execute(current_user, command)
    except UserSettingsNotFoundError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_404_NOT_FOUND,
            problem_type="user_settings_not_found",
            title="User Settings Not Found",
            detail="ユーザー設定が見つかりません。",
        ) from exc
    return _to_settings_response(view)


@users_router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_my_account(
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> Response:
    """認証ユーザー本人のアカウントを削除する。

    関連する user_settings / sessions / outputs / judgments は FK CASCADE により
    DB 側で連鎖削除される。Firebase Auth 上のアカウント本体は対象外。
    """
    container = get_presentation_container(request)
    await container.delete_account.execute(current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _to_profile_response(dto: UserProfileView) -> UserProfileResponse:
    return UserProfileResponse(
        id=dto.id,
        firebase_uid=dto.firebase_uid,
        auth_provider=dto.auth_provider,
        display_name=dto.display_name,
        age_group=dto.age_group,
        onboarding_completed=dto.onboarding_completed,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


def _to_settings_response(view: UserSettingsView) -> UserSettingsResponse:
    return UserSettingsResponse(
        input_minutes=view.input_minutes,
        output_minutes=view.output_minutes,
        break_minutes=view.break_minutes,
        notification_enabled=view.notification_enabled,
        updated_at=view.updated_at,
    )

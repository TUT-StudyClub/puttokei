"""ユーザーエンドポイント。

要件書 3.2.6 のうち、
- `GET/PATCH /api/v1/users/me/profile`: プロフィール取得・更新
- `GET/PATCH /api/v1/users/me/settings`: タイマー / 通知設定の取得・更新
- `DELETE /api/v1/users/me`: アカウントの論理削除（`deleted_at` をセット、30 日後バッチで物理削除）
を提供する。Firebase Auth 上のアカウント削除はクライアント側 (signOut) の責務。
"""

from fastapi import APIRouter, Depends, Request, Response, status

from src.application.dto.user_dto import UpdatePushTokenCommand, UpdateUserProfileCommand
from src.application.dto.user_settings_dto import UpdateUserSettingsCommand
from src.application.use_cases.get_user_settings import UserSettingsNotFoundError
from src.domain.entities.user import User
from src.presentation.container_access import get_presentation_container
from src.presentation.mappers.response_mapper import (
    to_user_profile_response,
    to_user_settings_response,
)
from src.presentation.middleware.auth_middleware import get_current_user
from src.presentation.problem_details import ProblemDetailsError
from src.presentation.schemas.user_schema import (
    UpdatePushTokenRequest,
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
    return to_user_profile_response(dto)


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
    return to_user_profile_response(dto)


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
    return to_user_settings_response(view)


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
    return to_user_settings_response(view)


@users_router.put(
    "/me/push-token",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def update_my_push_token(
    body: UpdatePushTokenRequest,
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> Response:
    """FCM プッシュトークンを置き換える。null を送るとトークンをクリアする。"""
    container = get_presentation_container(request)
    command = UpdatePushTokenCommand(fcm_token=body.fcm_token)
    await container.update_push_token.execute(current_user, command)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@users_router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_my_account(
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> Response:
    """認証ユーザー本人のアカウントを論理削除する。

    `users.deleted_at` をセットして FCM トークンをクリアする。関連する
    user_settings / sessions / outputs / judgments は保持され、30 日後のバッチ
    ジョブ（Issue #61）で物理削除される時点で FK ondelete=CASCADE により連鎖
    削除される。Firebase Auth 上のアカウント本体は対象外で、mobile 側で signOut
    させる。
    """
    container = get_presentation_container(request)
    await container.delete_account.execute(current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""ユーザーエンドポイント。

本 PR では要件書 3.2.6 のうち `/api/v1/users/me/profile` を実装する。
`/api/v1/users/me`、`/api/v1/users/me/settings`、削除系は後続 Task で実装する。
"""

from fastapi import APIRouter, Depends, Request

from src.application.dto.user_dto import UpdateUserProfileCommand, UserProfileView
from src.domain.entities.user import User
from src.presentation.container_access import get_presentation_container
from src.presentation.middleware.auth_middleware import get_current_user
from src.presentation.schemas.user_schema import (
    UpdateUserProfileRequest,
    UserProfileResponse,
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
    return _to_response(dto)


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
    return _to_response(dto)


def _to_response(dto: UserProfileView) -> UserProfileResponse:
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

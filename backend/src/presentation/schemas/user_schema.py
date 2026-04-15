"""/api/v1/users 系の Pydantic スキーマ。"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel, StrictRequestModel
from src.domain.value_objects.age_group import AgeGroup
from src.domain.value_objects.auth_provider import AuthProvider


class UserProfileResponse(FrozenModel):
    """GET /users/me/profile, PATCH /users/me/profile のレスポンス。"""

    id: UUID
    firebase_uid: str
    auth_provider: AuthProvider
    display_name: str | None
    age_group: AgeGroup | None
    onboarding_completed: bool
    created_at: datetime
    updated_at: datetime


class UpdateUserProfileRequest(StrictRequestModel):
    """PATCH /users/me/profile の body。

    未知フィールドは 422 で拒否する。省略された場合はサーバ側でその項目を更新しない
    扱いにすべきだが、本 API の現状仕様では明示 null を「値をクリア」と解釈する。
    """

    display_name: str | None = None
    age_group: AgeGroup | None = None

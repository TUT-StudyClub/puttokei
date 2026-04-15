"""User プロフィールまわりの DTO / コマンド。

CQRS 的な命名で役割を明示する:
- `UserProfileView`: クライアントに返却する読み出し用ビュー
- `UpdateUserProfileCommand`: プロフィール更新の意図を表す書き込み用コマンド
"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.age_group import AgeGroup
from src.domain.value_objects.auth_provider import AuthProvider


class UserProfileView(FrozenModel):
    """GET /users/me/profile のレスポンス元になるビュー。"""

    id: UUID
    firebase_uid: str
    auth_provider: AuthProvider
    display_name: str | None
    age_group: AgeGroup | None
    onboarding_completed: bool
    created_at: datetime
    updated_at: datetime


class UpdateUserProfileCommand(FrozenModel):
    """PATCH /users/me/profile の入力コマンド。

    フィールド省略の区別は presentation 層で吸収する前提で、本コマンドでは
    `display_name` / `age_group` を常に明示値（None を含む）で受ける。
    """

    display_name: str | None
    age_group: AgeGroup | None

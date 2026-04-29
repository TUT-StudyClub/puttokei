"""/api/v1/auth 系の Pydantic スキーマ。"""

from src.common.models import FrozenModel
from src.presentation.schemas.user_schema import UserProfileResponse


class VerifyAuthResponse(FrozenModel):
    """POST /api/v1/auth/verify のレスポンス。

    `is_new` は未登録 UID で初回呼び出しされたときのみ true になる。
    """

    user: UserProfileResponse
    is_new: bool

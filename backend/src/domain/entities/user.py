"""User エンティティ。Firebase UID と紐づく内部ユーザ。

要件書 4.3.1 の users テーブル相当。初回サインイン後はオンボーディング
（age_group 入力）を経て `onboarding_completed=True` となる。
"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.age_group import AgeGroup
from src.domain.value_objects.auth_provider import AuthProvider


class User(FrozenModel):
    """内部ユーザを表現するエンティティ。"""

    id: UUID
    firebase_uid: str
    auth_provider: AuthProvider
    display_name: str | None = None
    age_group: AgeGroup | None = None
    onboarding_completed: bool = False
    fcm_token: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    def with_profile(
        self,
        *,
        display_name: str | None,
        age_group: AgeGroup | None,
        updated_at: datetime,
    ) -> "User":
        """プロフィール更新後の新しい User を返す。

        age_group が渡された（非 None）場合は onboarding_completed を True にする。
        display_name は渡された値で上書き（None もそのまま反映）する。
        """
        return self.model_copy(
            update={
                "display_name": display_name,
                "age_group": age_group,
                "onboarding_completed": age_group is not None or self.onboarding_completed,
                "updated_at": updated_at,
            }
        )

    def with_deleted_at(self, *, deleted_at: datetime) -> "User":
        """論理削除済みの新しい User を返す。

        deleted_at をセットし、以降の push 通知が飛ばないよう fcm_token をクリアする。
        updated_at も同時刻で更新し、他フィールドは保持する。
        """
        return self.model_copy(
            update={
                "deleted_at": deleted_at,
                "fcm_token": None,
                "updated_at": deleted_at,
            }
        )

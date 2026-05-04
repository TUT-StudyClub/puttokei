"""ユーザーがアウトプットに割り当てる教科。"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel


class StudySubject(FrozenModel):
    """ユーザー単位で保存する教科名と表示色。"""

    id: UUID
    user_id: UUID
    label: str
    color: str
    created_at: datetime
    updated_at: datetime

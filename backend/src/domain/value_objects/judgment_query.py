"""判定履歴取得で使う検索条件の値オブジェクト。"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from src.common.models import FrozenModel


class JudgmentSort(str, Enum):
    """判定履歴一覧の並び順。"""

    JUDGED_AT_DESC = "judged_at_desc"
    JUDGED_AT_ASC = "judged_at_asc"


class JudgmentListCursor(FrozenModel):
    """判定履歴一覧の keyset pagination カーソル。"""

    judged_at: datetime
    judgment_id: UUID

"""Stats リポジトリの抽象 IF。"""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.verdict import Verdict


class StatsAggregationRow(FrozenModel):
    """統計集計に必要な最小限の永続化データ。"""

    session_id: UUID
    submitted_at: datetime
    input_minutes: int
    output_minutes: int
    break_minutes: int
    verdict: Verdict | None


class StatsRepository(ABC):
    """統計集計用の読み取りリポジトリ。"""

    @abstractmethod
    async def list_aggregation_rows(
        self,
        *,
        user_id: UUID,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> list[StatsAggregationRow]:
        """ユーザー単位で、アウトプット送信済みセッションの集計行を返す。"""

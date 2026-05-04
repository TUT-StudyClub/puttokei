"""Stats リポジトリの PostgreSQL 実装。"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.repositories.stats_repository import StatsAggregationRow, StatsRepository
from src.domain.value_objects.verdict import Verdict
from src.infrastructure.persistence.models.judgment_model import JudgmentModel
from src.infrastructure.persistence.models.output_model import OutputModel
from src.infrastructure.persistence.models.session_model import SessionModel


class PgStatsRepository(StatsRepository):
    """PostgreSQL から統計集計用の行を取得する。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_aggregation_rows(
        self,
        *,
        user_id: UUID,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> list[StatsAggregationRow]:
        stmt = (
            select(
                SessionModel.id,
                OutputModel.submitted_at,
                SessionModel.input_minutes,
                SessionModel.output_minutes,
                SessionModel.break_minutes,
                JudgmentModel.verdict,
            )
            .join(OutputModel, OutputModel.session_id == SessionModel.id)
            .outerjoin(JudgmentModel, JudgmentModel.session_id == SessionModel.id)
            .where(SessionModel.user_id == user_id)
            .order_by(OutputModel.submitted_at.asc(), SessionModel.id.asc())
        )
        if start_at is not None:
            stmt = stmt.where(OutputModel.submitted_at >= start_at)
        if end_at is not None:
            stmt = stmt.where(OutputModel.submitted_at < end_at)

        result = await self._session.execute(stmt)
        return [
            StatsAggregationRow(
                session_id=row.id,
                submitted_at=row.submitted_at,
                input_minutes=row.input_minutes,
                output_minutes=row.output_minutes,
                break_minutes=row.break_minutes,
                verdict=Verdict(row.verdict) if row.verdict is not None else None,
            )
            for row in result.all()
        ]

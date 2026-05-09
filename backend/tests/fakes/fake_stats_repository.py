"""インメモリな StatsRepository 実装。"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from src.domain.repositories.stats_repository import StatsAggregationRow, StatsRepository
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository
from tests.fakes.fake_output_repository import FakeOutputRepository
from tests.fakes.fake_session_repository import FakeSessionRepository


class FakeStatsRepository(StatsRepository):
    """fake repository 群から統計集計用の行を組み立てる。"""

    def __init__(self) -> None:
        self._sessions: FakeSessionRepository | None = None
        self._outputs: FakeOutputRepository | None = None
        self._judgments: FakeJudgmentRepository | None = None

    def bind_sources(
        self,
        *,
        sessions: FakeSessionRepository,
        outputs: FakeOutputRepository,
        judgments: FakeJudgmentRepository,
    ) -> None:
        self._sessions = sessions
        self._outputs = outputs
        self._judgments = judgments

    async def list_aggregation_rows(
        self,
        *,
        user_id: UUID,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> list[StatsAggregationRow]:
        sessions = self._require_sessions()
        outputs = self._require_outputs()
        judgments = self._require_judgments()

        rows = []
        for session in sessions.sessions.values():
            if session.user_id != user_id:
                continue

            output = outputs.outputs_by_session_id.get(session.id)
            if output is None:
                continue
            if start_at is not None and output.submitted_at < start_at:
                continue
            if end_at is not None and output.submitted_at >= end_at:
                continue

            judgment = judgments.judgments_by_session_id.get(session.id)
            rows.append(
                StatsAggregationRow(
                    session_id=session.id,
                    submitted_at=output.submitted_at,
                    input_minutes=session.input_minutes,
                    output_minutes=session.output_minutes,
                    break_minutes=session.break_minutes,
                    verdict=judgment.verdict if judgment is not None else None,
                )
            )

        rows.sort(key=lambda row: (row.submitted_at, row.session_id))
        return rows

    def _require_sessions(self) -> FakeSessionRepository:
        if self._sessions is None:
            raise RuntimeError("FakeStatsRepository sources are not bound")
        return self._sessions

    def _require_outputs(self) -> FakeOutputRepository:
        if self._outputs is None:
            raise RuntimeError("FakeStatsRepository sources are not bound")
        return self._outputs

    def _require_judgments(self) -> FakeJudgmentRepository:
        if self._judgments is None:
            raise RuntimeError("FakeStatsRepository sources are not bound")
        return self._judgments

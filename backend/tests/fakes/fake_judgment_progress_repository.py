"""インメモリな JudgmentProgressRepository 実装。"""

from uuid import UUID

from src.domain.entities.judgment_progress import JudgmentProgress
from src.domain.repositories.judgment_progress_repository import (
    JudgmentProgressRepository,
)
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)


class FakeJudgmentProgressRepository(JudgmentProgressRepository):
    """in-memory な JudgmentProgressRepository。テスト以外で使用しない。"""

    def __init__(self) -> None:
        self.progress_by_session_id: dict[UUID, JudgmentProgress] = {}

    async def upsert(self, progress: JudgmentProgress) -> None:
        existing = self.progress_by_session_id.get(progress.session_id)
        event_seq = progress.event_seq if existing is None else existing.event_seq + 1
        started_at = progress.started_at
        if existing is not None and not (
            progress.status is JudgmentProgressStatus.QUEUED
            and progress.stage is JudgmentProgressStage.QUEUED
        ):
            started_at = existing.started_at
        self.progress_by_session_id[progress.session_id] = progress.model_copy(
            update={"event_seq": event_seq, "started_at": started_at}
        )

    async def find_by_session_id(self, session_id: UUID) -> JudgmentProgress | None:
        return self.progress_by_session_id.get(session_id)

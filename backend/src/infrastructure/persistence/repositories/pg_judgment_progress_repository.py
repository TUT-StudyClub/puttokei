"""JudgmentProgress リポジトリの PostgreSQL 実装。"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.judgment_progress import JudgmentProgress
from src.domain.repositories.judgment_progress_repository import (
    JudgmentProgressRepository,
)
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.infrastructure.persistence.models.judgment_progress_model import (
    JudgmentProgressModel,
)


class PgJudgmentProgressRepository(JudgmentProgressRepository):
    """PostgreSQL 実装。commit / rollback は Unit of Work が担う。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(self, progress: JudgmentProgress) -> None:
        stmt = (
            select(JudgmentProgressModel)
            .where(JudgmentProgressModel.session_id == progress.session_id)
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            self._session.add(
                JudgmentProgressModel(
                    session_id=progress.session_id,
                    status=progress.status.value,
                    stage=progress.stage.value,
                    percent=progress.percent,
                    message=progress.message,
                    event_seq=progress.event_seq,
                    started_at=progress.started_at,
                    updated_at=progress.updated_at,
                    completed_at=progress.completed_at,
                    error_code=progress.error_code,
                )
            )
        else:
            should_reset_started_at = (
                progress.status is JudgmentProgressStatus.QUEUED
                and progress.stage is JudgmentProgressStage.QUEUED
            )
            model.status = progress.status.value
            model.stage = progress.stage.value
            model.percent = progress.percent
            model.message = progress.message
            model.event_seq += 1
            if should_reset_started_at:
                model.started_at = progress.started_at
            model.updated_at = progress.updated_at
            model.completed_at = progress.completed_at
            model.error_code = progress.error_code

        await self._session.flush()

    async def find_by_session_id(self, session_id: UUID) -> JudgmentProgress | None:
        stmt = select(JudgmentProgressModel).where(JudgmentProgressModel.session_id == session_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_progress(model) if model is not None else None


def _to_progress(model: JudgmentProgressModel) -> JudgmentProgress:
    return JudgmentProgress(
        session_id=model.session_id,
        status=JudgmentProgressStatus(model.status),
        stage=JudgmentProgressStage(model.stage),
        percent=model.percent,
        message=model.message,
        event_seq=model.event_seq,
        started_at=model.started_at,
        updated_at=model.updated_at,
        completed_at=model.completed_at,
        error_code=model.error_code,
    )

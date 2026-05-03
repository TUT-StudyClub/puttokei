"""StudySubject リポジトリの PostgreSQL 実装。"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.study_subject import StudySubject
from src.domain.repositories.study_subject_repository import StudySubjectRepository
from src.infrastructure.persistence.models.study_subject_model import (
    OutputSubjectAssignmentModel,
    StudySubjectModel,
)


class PgStudySubjectRepository(StudySubjectRepository):
    """PostgreSQL 実装。commit / rollback は Unit of Work が担う。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_user_id_and_label(
        self,
        user_id: UUID,
        label: str,
    ) -> StudySubject | None:
        stmt = select(StudySubjectModel).where(
            StudySubjectModel.user_id == user_id,
            StudySubjectModel.label == label,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_study_subject(model) if model is not None else None

    async def upsert(self, subject: StudySubject) -> None:
        stmt = select(StudySubjectModel).where(StudySubjectModel.id == subject.id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            self._session.add(
                StudySubjectModel(
                    id=subject.id,
                    user_id=subject.user_id,
                    label=subject.label,
                    color=subject.color,
                    created_at=subject.created_at,
                    updated_at=subject.updated_at,
                )
            )
        else:
            model.label = subject.label
            model.color = subject.color
            model.updated_at = subject.updated_at

        await self._session.flush()

    async def assign_to_output(
        self,
        *,
        output_id: UUID,
        subject_id: UUID,
        assigned_at: datetime,
    ) -> None:
        stmt = select(OutputSubjectAssignmentModel).where(
            OutputSubjectAssignmentModel.output_id == output_id
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            self._session.add(
                OutputSubjectAssignmentModel(
                    output_id=output_id,
                    subject_id=subject_id,
                    created_at=assigned_at,
                    updated_at=assigned_at,
                )
            )
        else:
            model.subject_id = subject_id
            model.updated_at = assigned_at

        await self._session.flush()

    async def find_assigned_subject_by_output_id(
        self,
        output_id: UUID,
    ) -> StudySubject | None:
        stmt = (
            select(StudySubjectModel)
            .join(
                OutputSubjectAssignmentModel,
                OutputSubjectAssignmentModel.subject_id == StudySubjectModel.id,
            )
            .where(OutputSubjectAssignmentModel.output_id == output_id)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_study_subject(model) if model is not None else None


def _to_study_subject(model: StudySubjectModel) -> StudySubject:
    return StudySubject(
        id=model.id,
        user_id=model.user_id,
        label=model.label,
        color=model.color,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )

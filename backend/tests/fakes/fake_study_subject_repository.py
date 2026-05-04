"""インメモリな StudySubjectRepository 実装。"""

from datetime import datetime
from uuid import UUID

from src.domain.entities.study_subject import StudySubject
from src.domain.repositories.study_subject_repository import StudySubjectRepository


class FakeStudySubjectRepository(StudySubjectRepository):
    """in-memory な StudySubjectRepository。テスト以外で使用しない。"""

    def __init__(self) -> None:
        self.subjects: dict[UUID, StudySubject] = {}
        self.subject_id_by_output_id: dict[UUID, UUID] = {}

    async def find_by_user_id_and_label(
        self,
        user_id: UUID,
        label: str,
    ) -> StudySubject | None:
        for subject in self.subjects.values():
            if subject.user_id == user_id and subject.label == label:
                return subject
        return None

    async def upsert(self, subject: StudySubject) -> None:
        self.subjects[subject.id] = subject

    async def assign_to_output(
        self,
        *,
        output_id: UUID,
        subject_id: UUID,
        assigned_at: datetime,  # noqa: ARG002
    ) -> None:
        self.subject_id_by_output_id[output_id] = subject_id

    async def find_assigned_subject_by_output_id(
        self,
        output_id: UUID,
    ) -> StudySubject | None:
        subject_id = self.subject_id_by_output_id.get(output_id)
        if subject_id is None:
            return None
        return self.subjects.get(subject_id)

"""StudySubject とアウトプットへの割り当てを扱う repository IF。"""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from src.domain.entities.study_subject import StudySubject


class StudySubjectRepository(ABC):
    """ユーザー教科と output 単位の割り当てに対する抽象 IF。"""

    @abstractmethod
    async def find_by_user_id_and_label(
        self,
        user_id: UUID,
        label: str,
    ) -> StudySubject | None:
        """ユーザー ID と教科名で取得する。存在しなければ None。"""

    @abstractmethod
    async def upsert(self, subject: StudySubject) -> None:
        """教科を保存または更新する。"""

    @abstractmethod
    async def assign_to_output(
        self,
        *,
        output_id: UUID,
        subject_id: UUID,
        assigned_at: datetime,
    ) -> None:
        """アウトプットに教科を割り当てる。"""

    @abstractmethod
    async def find_assigned_subject_by_output_id(
        self,
        output_id: UUID,
    ) -> StudySubject | None:
        """アウトプットに割り当て済みの教科を取得する。"""

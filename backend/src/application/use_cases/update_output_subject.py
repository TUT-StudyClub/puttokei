"""アウトプットに教科と色を割り当てる UseCase。"""

from datetime import UTC, datetime
from uuid import uuid4

from src.application.dto.session_dto import (
    OutputSubjectAssignmentView,
    UpdateOutputSubjectCommand,
)
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.study_subject import StudySubject
from src.domain.entities.user import User


class OutputNotFoundError(Exception):
    """当該 output が存在しない、または別ユーザーのため参照できない。"""


class UpdateOutputSubject:
    """output_id 単位で教科名と表示色を保存する。"""

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(
        self,
        current_user: User,
        command: UpdateOutputSubjectCommand,
    ) -> OutputSubjectAssignmentView:
        now = datetime.now(UTC)

        async with self.unit_of_work_factory() as uow:
            output = await uow.outputs.find_by_id(command.output_id)
            if output is None:
                raise OutputNotFoundError("output not found")

            session = await uow.sessions.find_by_id(output.session_id)
            if session is None or session.user_id != current_user.id:
                raise OutputNotFoundError("output not found")

            subject = await uow.study_subjects.find_by_user_id_and_label(
                current_user.id,
                command.label,
            )
            if subject is None:
                subject = StudySubject(
                    id=uuid4(),
                    user_id=current_user.id,
                    label=command.label,
                    color=command.color,
                    created_at=now,
                    updated_at=now,
                )
            elif subject.color != command.color:
                subject = subject.model_copy(
                    update={
                        "color": command.color,
                        "updated_at": now,
                    }
                )

            await uow.study_subjects.upsert(subject)
            await uow.study_subjects.assign_to_output(
                output_id=output.id,
                subject_id=subject.id,
                assigned_at=now,
            )
            await uow.commit()

        return OutputSubjectAssignmentView(
            output_id=command.output_id,
            subject_id=subject.id,
            subject=subject.label,
            subject_color=subject.color,
            updated_at=now,
        )

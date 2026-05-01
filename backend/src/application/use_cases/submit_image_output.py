"""画像アウトプット送信のユースケース。"""

from datetime import UTC, datetime
from uuid import uuid4

from src.application.dto.session_dto import SubmitImageOutputCommand, SubmitOutputView
from src.application.mappers.session_mapper import to_output_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.judgment_progress import JudgmentProgress
from src.domain.entities.output import Output
from src.domain.entities.user import User
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.domain.value_objects.output_kind import OutputKind


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class InvalidSessionStatusError(Exception):
    """アウトプット送信が許可されていないセッション状態。"""


class SubmitImageOutput:
    """画像アウトプット (GCS path) を保存し、セッションを judging に進める。"""

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(
        self,
        current_user: User,
        command: SubmitImageOutputCommand,
    ) -> SubmitOutputView:
        async with self.unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(command.session_id)
            if session is None or session.user_id != current_user.id:
                raise SessionNotFoundError("session not found")

            if not session.can_accept_output():
                raise InvalidSessionStatusError(
                    f"cannot submit output while session is {session.status.value}"
                )

            existing_output = await uow.outputs.find_by_session_id(session.id)
            output = Output(
                id=existing_output.id if existing_output is not None else uuid4(),
                session_id=session.id,
                kind=OutputKind.IMAGE,
                content=None,
                image_storage_path=command.image_storage_path,
                submitted_at=command.submitted_at,
            )
            await uow.outputs.upsert(output)

            updated_status = session.status_after_output_submission()
            if updated_status is not session.status:
                updated_session = session.with_status(new_status=updated_status)
                await uow.sessions.update(updated_session)
            else:
                updated_session = session

            now = datetime.now(UTC)
            await uow.judgment_progresses.upsert(
                JudgmentProgress(
                    session_id=session.id,
                    status=JudgmentProgressStatus.QUEUED,
                    stage=JudgmentProgressStage.QUEUED,
                    percent=5,
                    message="判定をキューに登録しました。",
                    event_seq=1,
                    started_at=now,
                    updated_at=now,
                    completed_at=None,
                    error_code=None,
                )
            )

            await uow.commit()

        return SubmitOutputView(
            output=to_output_view(output),
            status=updated_session.status,
        )

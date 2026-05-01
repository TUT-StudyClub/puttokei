"""判定進捗取得のユースケース。"""

from datetime import UTC, datetime
from uuid import UUID

from src.application.dto.judgment_dto import JudgmentProgressView
from src.application.mappers.judgment_progress_mapper import to_judgment_progress_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.judgment_progress import JudgmentProgress
from src.domain.entities.user import User
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.domain.value_objects.session_status import SessionStatus


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class JudgmentProgressNotAvailableError(Exception):
    """判定進捗を取得できるフェーズではない。"""


class GetJudgmentProgress:
    """判定進捗の現在値を返す。"""

    def __init__(self, *, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(self, current_user: User, session_id: UUID) -> JudgmentProgressView:
        async with self.unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(session_id)
            if session is None or session.user_id != current_user.id:
                raise SessionNotFoundError("session not found")

            if not session.can_fetch_judgment():
                raise JudgmentProgressNotAvailableError(
                    f"cannot fetch judgment progress while session is {session.status.value}"
                )

            progress = await uow.judgment_progresses.find_by_session_id(session.id)
            if progress is not None:
                return to_judgment_progress_view(progress)

            judgment = await uow.judgments.find_by_session_id(session.id)
            if judgment is not None:
                return _synthetic_completed_progress(session_id=session.id, at=judgment.judged_at)

            output = await uow.outputs.find_by_session_id(session.id)
            if output is None:
                raise JudgmentProgressNotAvailableError("output has not been submitted")

            if session.status is SessionStatus.JUDGING:
                return _synthetic_queued_progress(session_id=session.id, at=output.submitted_at)

            raise JudgmentProgressNotAvailableError("judgment progress has not been saved")


def _synthetic_completed_progress(*, session_id: UUID, at: datetime) -> JudgmentProgressView:
    progress = JudgmentProgress(
        session_id=session_id,
        status=JudgmentProgressStatus.COMPLETED,
        stage=JudgmentProgressStage.COMPLETED,
        percent=100,
        message="採点が完了しました。",
        event_seq=1,
        started_at=at,
        updated_at=at,
        completed_at=at,
        error_code=None,
    )
    return to_judgment_progress_view(progress)


def _synthetic_queued_progress(*, session_id: UUID, at: datetime) -> JudgmentProgressView:
    now = datetime.now(UTC)
    progress = JudgmentProgress(
        session_id=session_id,
        status=JudgmentProgressStatus.QUEUED,
        stage=JudgmentProgressStage.QUEUED,
        percent=5,
        message="判定を待機しています。",
        event_seq=1,
        started_at=at,
        updated_at=now,
        completed_at=None,
        error_code=None,
    )
    return to_judgment_progress_view(progress)

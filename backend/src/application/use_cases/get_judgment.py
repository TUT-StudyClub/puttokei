"""判定結果取得のユースケース。"""

from datetime import UTC, datetime, timedelta
from math import ceil
from uuid import UUID

from src.application.dto.judgment_dto import JudgmentPendingView, JudgmentView
from src.application.mappers.judgment_mapper import to_judgment_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User
from src.domain.value_objects.judgment_progress import JudgmentProgressStatus
from src.domain.value_objects.session_status import SessionStatus

_PENDING_BUFFER_SECONDS = 10
_PENDING_RETRY_AFTER_SECONDS = 10


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class JudgmentNotAvailableError(Exception):
    """判定取得前のステータスであり、まだ結果取得フェーズではない。"""


class OutputNotSubmittedError(Exception):
    """判定対象のアウトプットがまだ保存されていない。"""


class GetJudgment:
    """判定結果を返す。未完了なら pending を返す。"""

    def __init__(
        self,
        *,
        unit_of_work_factory: UnitOfWorkFactory,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(
        self,
        current_user: User,
        session_id: UUID,
    ) -> JudgmentView | JudgmentPendingView:
        async with self.unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(session_id)
            if session is None or session.user_id != current_user.id:
                raise SessionNotFoundError("session not found")

            if not session.can_fetch_judgment():
                raise JudgmentNotAvailableError(
                    f"cannot fetch judgment while session is {session.status.value}"
                )

            existing = await uow.judgments.find_by_session_id(session.id)
            if existing is not None:
                return to_judgment_view(existing)

            output = await uow.outputs.find_by_session_id(session.id)
            if output is None:
                raise OutputNotSubmittedError("output not submitted")

            progress = await uow.judgment_progresses.find_by_session_id(session.id)
            if progress is not None and progress.status is JudgmentProgressStatus.FAILED:
                raise JudgmentNotAvailableError(progress.message)

            if session.status is not SessionStatus.JUDGING:
                raise JudgmentNotAvailableError("judgment result has not been saved")

            now = datetime.now(UTC)
            ready_at = output.submitted_at + timedelta(
                minutes=session.break_minutes,
                seconds=_PENDING_BUFFER_SECONDS,
            )
            estimated_ready_at = (
                ready_at
                if now < ready_at
                else now + timedelta(seconds=_PENDING_RETRY_AFTER_SECONDS)
            )
            return JudgmentPendingView(
                detail="判定結果を準備しています。少し待ってから再確認してください。",
                retry_after_seconds=max(1, ceil((estimated_ready_at - now).total_seconds())),
                estimated_ready_at=estimated_ready_at,
            )

"""アウトプット送信と判定キューイングのユースケース。"""

from uuid import uuid4

from src.application.dto.session_dto import OutputView, SubmitOutputCommand, SubmitOutputView
from src.domain.entities.output import Output
from src.domain.entities.user import User
from src.domain.repositories.output_repository import OutputRepository
from src.domain.repositories.session_repository import SessionRepository
from src.domain.value_objects.session_status import SessionStatus


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class InvalidSessionStatusError(Exception):
    """アウトプット送信が許可されていないセッション状態。"""


_ALLOWED_OUTPUT_STATUSES = frozenset({SessionStatus.OUTPUT, SessionStatus.JUDGING})


class SubmitOutput:
    """アウトプット本文を保存し、セッションを judging に進める。"""

    def __init__(
        self,
        session_repository: SessionRepository,
        output_repository: OutputRepository,
    ) -> None:
        self.session_repository = session_repository
        self.output_repository = output_repository

    async def execute(self, current_user: User, command: SubmitOutputCommand) -> SubmitOutputView:
        session = await self.session_repository.find_by_id(command.session_id)
        if session is None or session.user_id != current_user.id:
            raise SessionNotFoundError("session not found")

        if session.status not in _ALLOWED_OUTPUT_STATUSES:
            raise InvalidSessionStatusError(
                f"cannot submit output while session is {session.status.value}"
            )

        existing_output = await self.output_repository.find_by_session_id(session.id)
        output = Output(
            id=existing_output.id if existing_output is not None else uuid4(),
            session_id=session.id,
            content=command.content,
            submitted_at=command.submitted_at,
        )
        await self.output_repository.upsert(output)

        if session.status is SessionStatus.OUTPUT:
            updated_session = session.with_status(new_status=SessionStatus.JUDGING)
            await self.session_repository.update(updated_session)
        else:
            updated_session = session

        return SubmitOutputView(
            output=OutputView(
                id=output.id,
                session_id=output.session_id,
                content=output.content,
                submitted_at=output.submitted_at,
            ),
            status=updated_session.status,
        )

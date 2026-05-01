"""アウトプット送信のユースケース。"""

from uuid import uuid4

from src.application.dto.session_dto import SubmitOutputCommand, SubmitOutputView
from src.application.mappers.session_mapper import to_output_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.output import Output
from src.domain.entities.user import User


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class InvalidSessionStatusError(Exception):
    """アウトプット送信が許可されていないセッション状態。"""


class SubmitOutput:
    """アウトプット本文を保存し、セッションを judging に進める。"""

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(self, current_user: User, command: SubmitOutputCommand) -> SubmitOutputView:
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
                content=command.content,
                submitted_at=command.submitted_at,
            )
            await uow.outputs.upsert(output)

            updated_status = session.status_after_output_submission()
            if updated_status is not session.status:
                updated_session = session.with_status(new_status=updated_status)
                await uow.sessions.update(updated_session)
            else:
                updated_session = session

            await uow.commit()

        return SubmitOutputView(
            output=to_output_view(output),
            status=updated_session.status,
        )

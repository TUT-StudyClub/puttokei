"""アウトプット送信と判定キューイングのユースケース。"""

from datetime import UTC, datetime
from uuid import uuid4

from src.application.dto.session_dto import SubmitOutputCommand, SubmitOutputView
from src.application.mappers.session_mapper import to_output_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.judgment import Judgment, JudgmentCorrection
from src.domain.entities.output import Output
from src.domain.entities.user import User
from src.domain.services.llm_judge_service import LLMJudgeService
from src.domain.value_objects.session_status import SessionStatus


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class InvalidSessionStatusError(Exception):
    """アウトプット送信が許可されていないセッション状態。"""


class SubmitOutput:
    """アウトプット本文を保存し、セッションを judging に進める。"""

    def __init__(
        self,
        unit_of_work_factory: UnitOfWorkFactory,
        *,
        local_judgment_enabled: bool = False,
        judge_service: LLMJudgeService | None = None,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory
        self.local_judgment_enabled = local_judgment_enabled
        self.judge_service = judge_service

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

            if self.local_judgment_enabled and self.judge_service is not None:
                existing_judgment = await uow.judgments.find_by_session_id(session.id)
                if existing_judgment is None:
                    judged_at = datetime.now(UTC)
                    result = await self.judge_service.judge(
                        prompt_input=session.topic,
                        user_output=output.content,
                    )
                    await uow.judgments.add(
                        Judgment(
                            id=uuid4(),
                            session_id=session.id,
                            verdict=result.verdict,
                            score=result.score,
                            advice=result.advice,
                            corrections=[
                                JudgmentCorrection(
                                    target_text=correction.target_text,
                                    correct_text=correction.correct_text,
                                    explanation=correction.explanation,
                                )
                                for correction in result.corrections
                            ],
                            judged_at=judged_at,
                        )
                    )
                    if updated_session.status is not SessionStatus.JUDGED:
                        updated_session = updated_session.with_status(
                            new_status=SessionStatus.JUDGED,
                            completed_at=judged_at,
                        )
                        await uow.sessions.update(updated_session)
            await uow.commit()

        return SubmitOutputView(
            output=to_output_view(output),
            status=updated_session.status,
        )

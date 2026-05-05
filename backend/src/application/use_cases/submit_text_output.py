"""テキストアウトプット送信のユースケース。"""

from src.application.dto.session_dto import SubmitTextOutputCommand
from src.application.use_cases._submit_output_base import (
    InvalidSessionStatusError,
    SessionNotFoundError,
    SubmitOutputBase,
    _next_output_id,
)
from src.domain.entities.output import Output
from src.domain.entities.session import Session
from src.domain.value_objects.output_kind import OutputKind

__all__ = [
    "InvalidSessionStatusError",
    "SessionNotFoundError",
    "SubmitTextOutput",
]


class SubmitTextOutput(SubmitOutputBase[SubmitTextOutputCommand]):
    """テキストアウトプット本文を保存し、セッションを judging に進める。"""

    def _build_output(
        self,
        *,
        command: SubmitTextOutputCommand,
        session: Session,
        existing_output: Output | None,
    ) -> Output:
        return Output(
            id=_next_output_id(existing_output),
            session_id=session.id,
            kind=OutputKind.TEXT,
            content=command.content,
            image_storage_path=None,
            submitted_at=command.submitted_at,
        )

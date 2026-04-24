"""Session / Output と application DTO の変換。"""

from src.application.dto.session_dto import OutputView, SessionView
from src.domain.entities.output import Output
from src.domain.entities.session import Session


def to_session_view(session: Session) -> SessionView:
    """domain.Session を session view に変換する。"""
    return SessionView(
        id=session.id,
        user_id=session.user_id,
        status=session.status,
        subject=session.subject,
        topic=session.topic,
        input_minutes=session.input_minutes,
        output_minutes=session.output_minutes,
        break_minutes=session.break_minutes,
        started_at=session.started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
    )


def to_output_view(output: Output) -> OutputView:
    """domain.Output を output view に変換する。"""
    return OutputView(
        id=output.id,
        session_id=output.session_id,
        content=output.content,
        submitted_at=output.submitted_at,
    )

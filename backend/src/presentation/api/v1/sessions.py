"""セッションエンドポイント。

本 PR では Issue #38 / #39 のスコープに合わせて `POST /api/v1/sessions` のみ実装する。
他エンドポイント（GET / PATCH / output / judgment）は Epic #3 後続 Task で追加する。
"""

from fastapi import APIRouter, Depends, Request, status

from src.application.dto.session_dto import CreateSessionCommand, SessionView
from src.container import Container
from src.domain.entities.user import User
from src.presentation.middleware.auth_middleware import get_current_user
from src.presentation.schemas.session_schema import (
    CreateSessionRequest,
    SessionResponse,
)

sessions_router = APIRouter(prefix="/sessions", tags=["sessions"])


@sessions_router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    body: CreateSessionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> SessionResponse:
    """新規セッションを作成し、初期ステータス input でレスポンスする。"""
    container: Container = request.app.state.container
    command = CreateSessionCommand(
        subject=body.subject,
        topic=body.topic,
        input_minutes=body.input_minutes,
        output_minutes=body.output_minutes,
        break_minutes=body.break_minutes,
    )
    view = await container.create_session.execute(current_user, command)
    return _to_response(view)


def _to_response(view: SessionView) -> SessionResponse:
    return SessionResponse(
        id=view.id,
        user_id=view.user_id,
        status=view.status,
        subject=view.subject,
        topic=view.topic,
        input_minutes=view.input_minutes,
        output_minutes=view.output_minutes,
        break_minutes=view.break_minutes,
        started_at=view.started_at,
        completed_at=view.completed_at,
        created_at=view.created_at,
    )

"""セッションエンドポイント。

- POST /api/v1/sessions: 新規セッション作成（Issue #39）
- PATCH /api/v1/sessions/{id}: フェーズ遷移に伴うステータス更新（Issue #41）

GET / 判定系は別 Task で追加する。
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status

from src.application.dto.session_dto import (
    CreateSessionCommand,
    SessionView,
    UpdateSessionStatusCommand,
)
from src.application.use_cases.update_session_status import (
    InvalidSessionStatusTransitionError,
    SessionNotFoundError,
)
from src.domain.entities.user import User
from src.presentation.container_access import get_presentation_container
from src.presentation.middleware.auth_middleware import get_current_user
from src.presentation.schemas.session_schema import (
    CreateSessionRequest,
    SessionResponse,
    UpdateSessionRequest,
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
    container = get_presentation_container(request)
    command = CreateSessionCommand(
        subject=body.subject,
        topic=body.topic,
        input_minutes=body.input_minutes,
        output_minutes=body.output_minutes,
        break_minutes=body.break_minutes,
    )
    view = await container.create_session.execute(current_user, command)
    return _to_response(view)


@sessions_router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    body: UpdateSessionRequest,
    request: Request,
    session_id: UUID = Path(...),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> SessionResponse:
    """Session の status を遷移させる。

    許可されない遷移は 400、存在しない / 他ユーザーの session は 404 を返す。
    """
    container = get_presentation_container(request)
    command = UpdateSessionStatusCommand(session_id=session_id, new_status=body.status)
    try:
        view = await container.update_session_status.execute(current_user, command)
    except SessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        ) from exc
    except InvalidSessionStatusTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
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

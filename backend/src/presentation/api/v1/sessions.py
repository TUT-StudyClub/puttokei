"""セッションエンドポイント。

- POST /api/v1/sessions: 新規セッション作成（Issue #39）
- PATCH /api/v1/sessions/{id}: フェーズ遷移に伴うステータス更新（Issue #41）
- POST /api/v1/sessions/{id}/output: アウトプット送信（Issue #51）
- GET /api/v1/sessions/{id}/judgment: 判定結果取得（Issue #51）
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Path, Request, status
from fastapi.responses import JSONResponse

from src.application.dto.judgment_dto import JudgmentPendingView
from src.application.dto.session_dto import (
    CreateSessionCommand,
    SessionView,
    SubmitOutputCommand,
    SubmitOutputView,
    UpdateSessionStatusCommand,
)
from src.application.use_cases.get_judgment import (
    JudgmentNotAvailableError,
    OutputNotSubmittedError,
)
from src.application.use_cases.get_judgment import (
    SessionNotFoundError as JudgmentSessionNotFoundError,
)
from src.application.use_cases.submit_output import (
    InvalidSessionStatusError as SubmitOutputInvalidSessionStatusError,
)
from src.application.use_cases.submit_output import (
    SessionNotFoundError as SubmitOutputSessionNotFoundError,
)
from src.application.use_cases.update_session_status import (
    InvalidSessionStatusTransitionError,
    SessionNotFoundError,
)
from src.domain.entities.user import User
from src.presentation.container_access import get_presentation_container
from src.presentation.middleware.auth_middleware import get_current_user
from src.presentation.problem_details import ProblemDetailsError
from src.presentation.schemas.judgment_schema import (
    JudgmentItemResponse,
    JudgmentPendingResponse,
    JudgmentResponse,
)
from src.presentation.schemas.session_schema import (
    CreateSessionRequest,
    OutputResponse,
    SessionResponse,
    SubmitOutputRequest,
    SubmitOutputResponse,
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
        raise ProblemDetailsError(
            status_code=status.HTTP_404_NOT_FOUND,
            problem_type="session_not_found",
            title="Session Not Found",
            detail="指定されたセッションが見つかりません。",
        ) from exc
    except InvalidSessionStatusTransitionError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_400_BAD_REQUEST,
            problem_type="invalid_session_transition",
            title="Invalid Session Transition",
            detail=str(exc),
        ) from exc
    return _to_response(view)


@sessions_router.post(
    "/{session_id}/output",
    response_model=SubmitOutputResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_output(
    body: SubmitOutputRequest,
    request: Request,
    session_id: UUID = Path(...),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> SubmitOutputResponse:
    """アウトプット本文を保存し、判定待ち状態に進める。"""
    container = get_presentation_container(request)
    command = SubmitOutputCommand(
        session_id=session_id,
        content=body.content,
        submitted_at=body.submitted_at,
    )
    try:
        view = await container.submit_output.execute(current_user, command)
    except SubmitOutputSessionNotFoundError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_404_NOT_FOUND,
            problem_type="session_not_found",
            title="Session Not Found",
            detail="指定されたセッションが見つかりません。",
        ) from exc
    except SubmitOutputInvalidSessionStatusError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_409_CONFLICT,
            problem_type="invalid_session_state",
            title="Invalid Session State",
            detail=str(exc),
        ) from exc
    return _to_submit_output_response(view)


@sessions_router.get(
    "/{session_id}/judgment",
    response_model=JudgmentResponse | JudgmentPendingResponse,
)
async def get_judgment(
    request: Request,
    session_id: UUID = Path(...),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> JudgmentResponse | JSONResponse:
    """判定結果を取得する。未完了なら 202 pending を返す。"""
    container = get_presentation_container(request)
    try:
        view = await container.get_judgment.execute(current_user, session_id)
    except JudgmentSessionNotFoundError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_404_NOT_FOUND,
            problem_type="session_not_found",
            title="Session Not Found",
            detail="指定されたセッションが見つかりません。",
        ) from exc
    except JudgmentNotAvailableError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_409_CONFLICT,
            problem_type="judgment_not_available",
            title="Judgment Not Available",
            detail=str(exc),
        ) from exc
    except OutputNotSubmittedError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_409_CONFLICT,
            problem_type="output_not_submitted",
            title="Output Not Submitted",
            detail=str(exc),
        ) from exc

    if isinstance(view, JudgmentPendingView):
        pending = JudgmentPendingResponse(
            status=view.status,
            detail=view.detail,
            retry_after_seconds=view.retry_after_seconds,
            estimated_ready_at=view.estimated_ready_at,
        )
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content=pending.model_dump(mode="json"),
            headers={"Retry-After": str(view.retry_after_seconds)},
        )

    return JudgmentResponse(
        id=view.id,
        session_id=view.session_id,
        verdict=view.verdict,
        score=view.score,
        advice=view.advice,
        items=[JudgmentItemResponse(label=item.label, comment=item.comment) for item in view.items],
        judged_at=view.judged_at,
    )


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


def _to_submit_output_response(view: SubmitOutputView) -> SubmitOutputResponse:
    return SubmitOutputResponse(
        output=OutputResponse(
            id=view.output.id,
            session_id=view.output.session_id,
            content=view.output.content,
            submitted_at=view.output.submitted_at,
        ),
        status=view.status,
    )

"""セッションエンドポイント。

- POST /api/v1/sessions: 新規セッション作成（Issue #39）
- PATCH /api/v1/sessions/{id}: フェーズ遷移に伴うステータス更新（Issue #41）
- POST /api/v1/sessions/{id}/output: アウトプット送信（Issue #51）
- GET /api/v1/sessions/{id}/judgment: 判定結果取得（Issue #51）
"""

import asyncio
from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Request, status
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse

from src.application.dto.judgment_dto import JudgmentPendingView, JudgmentProgressView
from src.application.dto.session_dto import (
    CreateSessionCommand,
    SubmitOutputCommand,
    UpdateSessionStatusCommand,
)
from src.application.use_cases.get_judgment import (
    JudgmentNotAvailableError,
    OutputNotSubmittedError,
)
from src.application.use_cases.get_judgment import (
    SessionNotFoundError as JudgmentSessionNotFoundError,
)
from src.application.use_cases.get_judgment_progress import (
    JudgmentProgressNotAvailableError,
)
from src.application.use_cases.get_judgment_progress import (
    SessionNotFoundError as JudgmentProgressSessionNotFoundError,
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
from src.presentation.mappers.response_mapper import (
    to_judgment_pending_response,
    to_judgment_progress_response,
    to_judgment_response,
    to_session_response,
    to_submit_output_response,
    to_today_outputs_response,
)
from src.presentation.middleware.auth_middleware import get_current_user
from src.presentation.problem_details import ProblemDetailsError
from src.presentation.schemas.judgment_schema import (
    JudgmentPendingResponse,
    JudgmentProgressResponse,
    JudgmentResponse,
)
from src.presentation.schemas.session_schema import (
    CreateSessionRequest,
    SessionResponse,
    SubmitOutputRequest,
    SubmitOutputResponse,
    TodayOutputsResponse,
    UpdateSessionRequest,
)

sessions_router = APIRouter(prefix="/sessions", tags=["sessions"])
_PROGRESS_STREAM_POLL_SECONDS = 1
_TERMINAL_PROGRESS_STATUSES = {"completed", "failed"}


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
    return to_session_response(view)


@sessions_router.get("/outputs/today", response_model=TodayOutputsResponse)
async def list_today_outputs(
    request: Request,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> TodayOutputsResponse:
    """インプット画面で見返すため、今日のアウトプット一覧を返す。"""
    container = get_presentation_container(request)
    view = await container.list_today_outputs.execute(current_user)
    return to_today_outputs_response(view)


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
    return to_session_response(view)


@sessions_router.post(
    "/{session_id}/output",
    response_model=SubmitOutputResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_output(
    body: SubmitOutputRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    session_id: UUID = Path(...),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> SubmitOutputResponse:
    """アウトプット本文を保存し、判定待ち状態に進める。

    `local_judgment_enabled` が有効な環境では LLM 判定を BackgroundTasks に登録し、
    レスポンス送信後に fire-and-forget で実行する。production など Cloud Tasks に
    寄せる構成では `run_local_judgment` が None なので、ここでは何も登録しない。
    """
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

    run_local_judgment = container.run_local_judgment
    if run_local_judgment is not None:
        background_tasks.add_task(
            run_local_judgment.execute,
            session_id=session_id,
        )

    return to_submit_output_response(view)


@sessions_router.get(
    "/{session_id}/judgment/progress",
    response_model=JudgmentProgressResponse,
)
async def get_judgment_progress(
    request: Request,
    session_id: UUID = Path(...),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> JudgmentProgressResponse:
    """判定進捗の現在値を取得する。"""
    container = get_presentation_container(request)
    try:
        view = await container.get_judgment_progress.execute(current_user, session_id)
    except JudgmentProgressSessionNotFoundError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_404_NOT_FOUND,
            problem_type="session_not_found",
            title="Session Not Found",
            detail="指定されたセッションが見つかりません。",
        ) from exc
    except JudgmentProgressNotAvailableError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_409_CONFLICT,
            problem_type="judgment_progress_not_available",
            title="Judgment Progress Not Available",
            detail=str(exc),
        ) from exc

    return to_judgment_progress_response(view)


@sessions_router.get("/{session_id}/judgment/progress/stream")
async def stream_judgment_progress(
    request: Request,
    session_id: UUID = Path(...),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> StreamingResponse:
    """判定進捗を Server-Sent Events で配信する。"""
    container = get_presentation_container(request)
    try:
        initial_view = await container.get_judgment_progress.execute(current_user, session_id)
    except JudgmentProgressSessionNotFoundError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_404_NOT_FOUND,
            problem_type="session_not_found",
            title="Session Not Found",
            detail="指定されたセッションが見つかりません。",
        ) from exc
    except JudgmentProgressNotAvailableError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_409_CONFLICT,
            problem_type="judgment_progress_not_available",
            title="Judgment Progress Not Available",
            detail=str(exc),
        ) from exc

    async def event_stream() -> AsyncGenerator[str, None]:
        last_event_seq = 0
        view = initial_view

        while True:
            if view.event_seq != last_event_seq:
                last_event_seq = view.event_seq
                yield _format_progress_event(view)

            if view.status.value in _TERMINAL_PROGRESS_STATUSES:
                break

            if await request.is_disconnected():
                break

            await asyncio.sleep(_PROGRESS_STREAM_POLL_SECONDS)
            view = await container.get_judgment_progress.execute(current_user, session_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
        pending = to_judgment_pending_response(view)
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content=pending.model_dump(mode="json"),
            headers={"Retry-After": str(view.retry_after_seconds)},
        )

    return to_judgment_response(view)


def _format_progress_event(view: JudgmentProgressView) -> str:
    payload = to_judgment_progress_response(view).model_dump_json()
    return f"id: {view.event_seq}\nevent: progress\ndata: {payload}\n\n"

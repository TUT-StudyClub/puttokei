"""判定履歴エンドポイント。

- GET /api/v1/judgments
- GET /api/v1/judgments/{id}
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status

from src.application.dto.judgment_dto import ListJudgmentsQuery
from src.application.use_cases.get_judgment_detail import JudgmentNotFoundError
from src.application.use_cases.list_judgments import (
    DEFAULT_JUDGMENT_LIST_LIMIT,
    MAX_JUDGMENT_LIST_LIMIT,
    InvalidJudgmentCursorError,
    InvalidJudgmentListFilterError,
)
from src.domain.entities.user import User
from src.domain.value_objects.judgment_query import JudgmentSort
from src.domain.value_objects.verdict import Verdict
from src.presentation.container_access import get_presentation_container
from src.presentation.mappers.response_mapper import (
    to_judgment_detail_response,
    to_judgment_list_response,
)
from src.presentation.middleware.auth_middleware import get_current_user
from src.presentation.problem_details import ProblemDetailsError
from src.presentation.schemas.judgment_schema import (
    JudgmentDetailResponse,
    JudgmentListResponse,
)

judgments_router = APIRouter(prefix="/judgments", tags=["judgments"])


@judgments_router.get("", response_model=JudgmentListResponse)
async def list_judgments(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=MAX_JUDGMENT_LIST_LIMIT),
    ] = DEFAULT_JUDGMENT_LIST_LIMIT,
    verdict: Annotated[Verdict | None, Query()] = None,
    judged_from: Annotated[datetime | None, Query()] = None,
    judged_to: Annotated[datetime | None, Query()] = None,
    sort: Annotated[JudgmentSort, Query()] = JudgmentSort.JUDGED_AT_DESC,
) -> JudgmentListResponse:
    """判定履歴一覧を filter / sort / pagination 付きで取得する。"""
    container = get_presentation_container(request)
    query = ListJudgmentsQuery(
        cursor=cursor,
        limit=limit,
        verdict=verdict,
        judged_from=judged_from,
        judged_to=judged_to,
        sort=sort,
    )
    try:
        view = await container.list_judgments.execute(current_user, query)
    except InvalidJudgmentCursorError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_400_BAD_REQUEST,
            problem_type="invalid_cursor",
            title="Invalid Cursor",
            detail="cursor が不正です。",
        ) from exc
    except InvalidJudgmentListFilterError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_400_BAD_REQUEST,
            problem_type="invalid_judgment_filter",
            title="Invalid Judgment Filter",
            detail=str(exc),
        ) from exc

    return to_judgment_list_response(view)


@judgments_router.get("/{judgment_id}", response_model=JudgmentDetailResponse)
async def get_judgment_detail(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    judgment_id: UUID,
) -> JudgmentDetailResponse:
    """判定 ID から判定詳細を取得する。"""
    container = get_presentation_container(request)
    try:
        view = await container.get_judgment_detail.execute(current_user, judgment_id)
    except JudgmentNotFoundError as exc:
        raise ProblemDetailsError(
            status_code=status.HTTP_404_NOT_FOUND,
            problem_type="judgment_not_found",
            title="Judgment Not Found",
            detail="指定された判定が見つかりません。",
        ) from exc

    return to_judgment_detail_response(view)

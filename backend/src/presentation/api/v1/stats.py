"""統計エンドポイント。

- GET /api/v1/stats/summary
- GET /api/v1/stats/daily
- GET /api/v1/stats/weekly
- GET /api/v1/stats/monthly
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from src.domain.entities.user import User
from src.presentation.container_access import get_presentation_container
from src.presentation.mappers.response_mapper import (
    to_daily_report_response,
    to_weekly_report_response,
)
from src.presentation.middleware.auth_middleware import get_current_user
from src.presentation.schemas.stats_schema import DailyReportResponse, WeeklyReportResponse

stats_router = APIRouter(prefix="/stats", tags=["stats"])


@stats_router.get("/weekly", response_model=WeeklyReportResponse)
async def get_weekly_report(
    request: Request,
    week_start: Annotated[date | None, Query()] = None,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> WeeklyReportResponse:
    """週単位レポート画面に必要な集計とアウトプット履歴を返す。"""
    container = get_presentation_container(request)
    view = await container.get_weekly_report.execute(current_user, week_start)
    return to_weekly_report_response(view)


@stats_router.get("/daily", response_model=DailyReportResponse)
async def get_daily_report(
    request: Request,
    target_date: Annotated[date | None, Query(alias="date")] = None,
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> DailyReportResponse:
    """日単位レポート画面に必要な集計とアウトプット履歴を返す。"""
    container = get_presentation_container(request)
    view = await container.get_daily_report.execute(current_user, target_date)
    return to_daily_report_response(view)

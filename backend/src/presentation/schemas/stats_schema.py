"""レポート / 統計 API の Pydantic スキーマ。"""

from datetime import date

from src.common.models import FrozenModel
from src.presentation.schemas.session_schema import OutputReviewItemResponse


class WeeklyReportSummaryResponse(FrozenModel):
    """週単位レポートのサマリー。"""

    input_minutes: int
    output_minutes: int
    break_minutes: int
    total_study_minutes: int
    total_sessions: int


class WeeklyReportPointResponse(FrozenModel):
    """週内 1 日分の集計点。"""

    bucket: date
    label: str
    study_minutes: int
    sessions: int


class WeeklyReportResponse(FrozenModel):
    """週単位レポート画面用レスポンス。"""

    week_start: date
    week_end: date
    summary: WeeklyReportSummaryResponse
    points: list[WeeklyReportPointResponse]
    output_history: list[OutputReviewItemResponse]

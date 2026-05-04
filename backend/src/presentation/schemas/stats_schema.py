"""レポート / 統計 API の Pydantic スキーマ。"""

from datetime import date

from pydantic import Field

from src.common.models import FrozenModel
from src.domain.value_objects.stats_period import StatsPeriod
from src.presentation.schemas.session_schema import OutputReviewItemResponse


class StatsSummaryResponse(FrozenModel):
    """代表指標のサマリーレスポンス。"""

    total_sessions: int
    total_study_minutes: int
    correct_rate: float
    streak_days: int
    period: StatsPeriod
    from_date: date = Field(serialization_alias="from")
    to_date: date = Field(serialization_alias="to")


class StatsDataPointResponse(FrozenModel):
    """期間別統計の 1 点。"""

    bucket: str
    label: str
    sessions: int
    study_minutes: int
    correct_rate: float


class StatsPeriodResponse(FrozenModel):
    """日 / 週 / 月単位の統計レスポンス。"""

    period: StatsPeriod
    points: list[StatsDataPointResponse]
    summary: StatsSummaryResponse


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


class DailyReportSummaryResponse(FrozenModel):
    """日単位レポートのサマリー。"""

    input_minutes: int
    output_minutes: int
    break_minutes: int
    total_study_minutes: int
    total_sessions: int


class DailyReportResponse(FrozenModel):
    """日単位レポート画面用レスポンス。"""

    date: date
    summary: DailyReportSummaryResponse
    output_history: list[OutputReviewItemResponse]

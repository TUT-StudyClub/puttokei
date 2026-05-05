"""レポート / 統計関連ユースケースの入出力 DTO。"""

from datetime import date

from src.application.dto.session_dto import OutputReviewItemView
from src.common.models import FrozenModel
from src.domain.value_objects.stats_period import StatsPeriod


class StatsSummaryView(FrozenModel):
    """代表指標のサマリー。"""

    total_sessions: int
    total_study_minutes: int
    correct_rate: float
    streak_days: int
    period: StatsPeriod
    from_date: date
    to_date: date


class StatsDataPointView(FrozenModel):
    """期間別統計の 1 点。"""

    bucket: str
    label: str
    sessions: int
    study_minutes: int
    correct_rate: float


class StatsPeriodView(FrozenModel):
    """日 / 週 / 月単位の統計レスポンス。"""

    period: StatsPeriod
    points: list[StatsDataPointView]
    summary: StatsSummaryView


class WeeklyReportSummaryView(FrozenModel):
    """週単位レポートのサマリー。"""

    input_minutes: int
    output_minutes: int
    break_minutes: int
    total_study_minutes: int
    total_sessions: int


class WeeklyReportPointView(FrozenModel):
    """週内 1 日分の集計点。"""

    bucket: date
    label: str
    study_minutes: int
    sessions: int


class WeeklyReportView(FrozenModel):
    """週単位レポート画面で使う一括ビュー。"""

    week_start: date
    week_end: date
    summary: WeeklyReportSummaryView
    points: list[WeeklyReportPointView]
    output_history: list[OutputReviewItemView]


class DailyReportSummaryView(FrozenModel):
    """日単位レポートのサマリー。"""

    input_minutes: int
    output_minutes: int
    break_minutes: int
    total_study_minutes: int
    total_sessions: int


class DailyReportView(FrozenModel):
    """日単位レポート画面で使う一括ビュー。"""

    date: date
    summary: DailyReportSummaryView
    output_history: list[OutputReviewItemView]

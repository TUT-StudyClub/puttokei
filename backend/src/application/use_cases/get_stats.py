"""統計取得のユースケース。"""

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from src.application.dto.stats_dto import (
    StatsDataPointView,
    StatsPeriodView,
    StatsSummaryView,
)
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User
from src.domain.repositories.stats_repository import StatsAggregationRow
from src.domain.value_objects.stats_period import StatsPeriod
from src.domain.value_objects.verdict import Verdict

_DEFAULT_TIMEZONE = ZoneInfo("Asia/Tokyo")


class GetStatsSummary:
    """認証済みユーザーの全期間サマリーを返す。"""

    def __init__(
        self,
        *,
        unit_of_work_factory: UnitOfWorkFactory,
        timezone: ZoneInfo = _DEFAULT_TIMEZONE,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory
        self.timezone = timezone

    async def execute(self, current_user: User) -> StatsSummaryView:
        async with self.unit_of_work_factory() as uow:
            rows = await uow.stats.list_aggregation_rows(user_id=current_user.id)

        bounds = _summary_bounds(rows, timezone=self.timezone)
        return _build_summary(
            rows,
            period=StatsPeriod.DAILY,
            from_date=bounds[0],
            to_date=bounds[1],
            timezone=self.timezone,
        )


class GetStatsPeriod:
    """認証済みユーザーの期間別統計を返す。"""

    def __init__(
        self,
        *,
        unit_of_work_factory: UnitOfWorkFactory,
        timezone: ZoneInfo = _DEFAULT_TIMEZONE,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory
        self.timezone = timezone

    async def execute(self, current_user: User, period: StatsPeriod) -> StatsPeriodView:
        async with self.unit_of_work_factory() as uow:
            rows = await uow.stats.list_aggregation_rows(user_id=current_user.id)

        points = _build_points(rows, period=period, timezone=self.timezone)
        from_date, to_date = _period_bounds(points, period=period, timezone=self.timezone)
        return StatsPeriodView(
            period=period,
            points=points,
            summary=_build_summary(
                rows,
                period=period,
                from_date=from_date,
                to_date=to_date,
                timezone=self.timezone,
            ),
        )


def _build_summary(
    rows: list[StatsAggregationRow],
    *,
    period: StatsPeriod,
    from_date: date,
    to_date: date,
    timezone: ZoneInfo,
) -> StatsSummaryView:
    total_sessions = len(rows)
    total_study_minutes = sum(row.input_minutes + row.output_minutes for row in rows)
    judged_count = sum(1 for row in rows if row.verdict is not None)
    correct_count = sum(1 for row in rows if row.verdict is Verdict.CORRECT)
    correct_rate = correct_count / judged_count if judged_count > 0 else 0.0
    active_dates = {
        _as_aware_datetime(row.submitted_at).astimezone(timezone).date() for row in rows
    }
    return StatsSummaryView(
        total_sessions=total_sessions,
        total_study_minutes=total_study_minutes,
        correct_rate=correct_rate,
        streak_days=_count_streak_days(active_dates),
        period=period,
        from_date=from_date,
        to_date=to_date,
    )


def _build_points(
    rows: list[StatsAggregationRow],
    *,
    period: StatsPeriod,
    timezone: ZoneInfo,
) -> list[StatsDataPointView]:
    if not rows:
        current = datetime.now(UTC).astimezone(timezone).date()
        bucket = _bucket_start(current, period)
        return [_build_point(bucket, [], period=period)]

    rows_by_bucket: dict[date, list[StatsAggregationRow]] = defaultdict(list)
    for row in rows:
        submitted_date = _as_aware_datetime(row.submitted_at).astimezone(timezone).date()
        rows_by_bucket[_bucket_start(submitted_date, period)].append(row)

    start = min(rows_by_bucket)
    end = max(rows_by_bucket)
    buckets = _iter_buckets(start, end, period)
    return [
        _build_point(bucket, rows_by_bucket.get(bucket, []), period=period) for bucket in buckets
    ]


def _build_point(
    bucket: date,
    rows: list[StatsAggregationRow],
    *,
    period: StatsPeriod,
) -> StatsDataPointView:
    judged_count = sum(1 for row in rows if row.verdict is not None)
    correct_count = sum(1 for row in rows if row.verdict is Verdict.CORRECT)
    correct_rate = correct_count / judged_count if judged_count > 0 else 0.0
    return StatsDataPointView(
        bucket=_bucket_key(bucket, period),
        label=_bucket_label(bucket, period),
        sessions=len(rows),
        study_minutes=sum(row.input_minutes + row.output_minutes for row in rows),
        correct_rate=correct_rate,
    )


def _summary_bounds(rows: list[StatsAggregationRow], *, timezone: ZoneInfo) -> tuple[date, date]:
    if not rows:
        current = datetime.now(UTC).astimezone(timezone).date()
        return current, current
    dates = [_as_aware_datetime(row.submitted_at).astimezone(timezone).date() for row in rows]
    return min(dates), max(dates)


def _period_bounds(
    points: list[StatsDataPointView],
    *,
    period: StatsPeriod,
    timezone: ZoneInfo,
) -> tuple[date, date]:
    if not points:
        current = datetime.now(UTC).astimezone(timezone).date()
        return current, current
    start = _parse_bucket_key(points[0].bucket, period)
    end = _bucket_end(_parse_bucket_key(points[-1].bucket, period), period)
    return start, end


def _bucket_start(value: date, period: StatsPeriod) -> date:
    if period is StatsPeriod.WEEKLY:
        days_since_sunday = (value.weekday() + 1) % 7
        return value - timedelta(days=days_since_sunday)
    if period is StatsPeriod.MONTHLY:
        return value.replace(day=1)
    return value


def _bucket_end(value: date, period: StatsPeriod) -> date:
    if period is StatsPeriod.WEEKLY:
        return value + timedelta(days=6)
    if period is StatsPeriod.MONTHLY:
        return _add_month(value) - timedelta(days=1)
    return value


def _iter_buckets(start: date, end: date, period: StatsPeriod) -> list[date]:
    buckets = []
    current = start
    while current <= end:
        buckets.append(current)
        current = _next_bucket(current, period)
    return buckets


def _next_bucket(value: date, period: StatsPeriod) -> date:
    if period is StatsPeriod.WEEKLY:
        return value + timedelta(days=7)
    if period is StatsPeriod.MONTHLY:
        return _add_month(value)
    return value + timedelta(days=1)


def _add_month(value: date) -> date:
    if value.month == 12:
        return value.replace(year=value.year + 1, month=1, day=1)
    return value.replace(month=value.month + 1, day=1)


def _bucket_key(value: date, period: StatsPeriod) -> str:
    if period is StatsPeriod.MONTHLY:
        return value.strftime("%Y-%m")
    return value.isoformat()


def _parse_bucket_key(value: str, period: StatsPeriod) -> date:
    if period is StatsPeriod.MONTHLY:
        return date.fromisoformat(f"{value}-01")
    return date.fromisoformat(value)


def _bucket_label(value: date, period: StatsPeriod) -> str:
    if period is StatsPeriod.MONTHLY:
        return f"{value.month}月"
    return f"{value.month}/{value.day}"


def _count_streak_days(active_dates: set[date]) -> int:
    if not active_dates:
        return 0
    current = max(active_dates)
    streak = 0
    while current in active_dates:
        streak += 1
        current -= timedelta(days=1)
    return streak


def _as_aware_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value

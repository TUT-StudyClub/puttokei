"""日単位レポートを取得する UseCase。"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from src.application.dto.session_dto import OutputReviewItemView
from src.application.dto.stats_dto import DailyReportSummaryView, DailyReportView
from src.application.mappers.judgment_mapper import to_judgment_view
from src.application.mappers.session_mapper import resolve_output_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User
from src.domain.services.output_image_storage import OutputImageStorage

_DEFAULT_SCAN_LIMIT = 500
_DEFAULT_TIMEZONE = ZoneInfo("Asia/Tokyo")


class GetDailyReport:
    """認証済みユーザーの日単位レポートを返す。"""

    def __init__(
        self,
        *,
        unit_of_work_factory: UnitOfWorkFactory,
        image_storage: OutputImageStorage | None = None,
        download_url_ttl_seconds: int = 900,
        timezone: ZoneInfo = _DEFAULT_TIMEZONE,
        scan_limit: int = _DEFAULT_SCAN_LIMIT,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory
        self.image_storage = image_storage
        self.download_url_ttl_seconds = download_url_ttl_seconds
        self.timezone = timezone
        self.scan_limit = scan_limit

    async def execute(self, current_user: User, target_date: date | None = None) -> DailyReportView:
        resolved_date = target_date or _current_date(self.timezone)
        start_at = datetime.combine(resolved_date, time.min, tzinfo=self.timezone)
        end_at = start_at + timedelta(days=1)

        input_minutes = 0
        output_minutes = 0
        break_minutes = 0
        rows = []

        async with self.unit_of_work_factory() as uow:
            sessions, _next_cursor = await uow.sessions.list_by_user(
                user_id=current_user.id,
                cursor=None,
                limit=self.scan_limit,
            )
            for session in sessions:
                output = await uow.outputs.find_by_session_id(session.id)
                if output is None:
                    continue

                submitted_at = _as_aware_datetime(output.submitted_at).astimezone(self.timezone)
                if not (start_at <= submitted_at < end_at):
                    continue

                input_minutes += session.input_minutes
                output_minutes += session.output_minutes
                break_minutes += session.break_minutes

                judgment = await uow.judgments.find_by_session_id(session.id)
                rows.append((submitted_at, session, output, judgment))

        rows.sort(key=lambda row: row[0])

        return DailyReportView(
            date=resolved_date,
            summary=DailyReportSummaryView(
                input_minutes=input_minutes,
                output_minutes=output_minutes,
                break_minutes=break_minutes,
                total_study_minutes=input_minutes + output_minutes,
                total_sessions=len(rows),
            ),
            output_history=[
                OutputReviewItemView(
                    session_id=session.id,
                    session_started_at=session.started_at,
                    input_minutes=session.input_minutes,
                    output_minutes=session.output_minutes,
                    output=resolve_output_view(
                        output,
                        storage=self.image_storage,
                        download_url_ttl_seconds=self.download_url_ttl_seconds,
                    ),
                    cycle_index=index,
                    subject=session.subject,
                    topic=session.topic,
                    judgment=to_judgment_view(judgment) if judgment is not None else None,
                )
                for index, (_submitted_at, session, output, judgment) in enumerate(rows, start=1)
            ],
        )


def _current_date(timezone: ZoneInfo) -> date:
    return datetime.now(UTC).astimezone(timezone).date()


def _as_aware_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value

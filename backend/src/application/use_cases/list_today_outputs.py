"""今日のアウトプットをインプット画面向けに取得する UseCase。"""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from src.application.dto.session_dto import OutputReviewItemView, TodayOutputsView
from src.application.mappers.judgment_mapper import to_judgment_view
from src.application.mappers.session_mapper import resolve_output_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User
from src.domain.services.output_image_storage import OutputImageStorage

_DEFAULT_SCAN_LIMIT = 50
_DEFAULT_TIMEZONE = ZoneInfo("Asia/Tokyo")


class ListTodayOutputs:
    """認証済みユーザーが今日送信したアウトプットを返す。"""

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

    async def execute(self, current_user: User) -> TodayOutputsView:
        today = datetime.now(UTC).astimezone(self.timezone).date()
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

                submitted_at = output.submitted_at
                if submitted_at.tzinfo is None:
                    submitted_at = submitted_at.replace(tzinfo=UTC)
                if submitted_at.astimezone(self.timezone).date() != today:
                    continue

                judgment = await uow.judgments.find_by_session_id(session.id)
                rows.append((session, output, judgment))

        rows.sort(key=lambda row: row[1].submitted_at)
        return TodayOutputsView(
            items=[
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
                for index, (session, output, judgment) in enumerate(rows, start=1)
            ]
        )

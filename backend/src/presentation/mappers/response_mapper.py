"""Application DTO を HTTP response schema に変換する。"""

from src.application.dto.judgment_dto import (
    JudgmentPendingView,
    JudgmentProgressView,
    JudgmentView,
)
from src.application.dto.session_dto import (
    OutputView,
    SessionView,
    SubmitOutputView,
    TodayOutputsView,
)
from src.application.dto.stats_dto import DailyReportView, WeeklyReportView
from src.application.dto.user_dto import UserProfileView
from src.application.dto.user_settings_dto import UserSettingsView
from src.presentation.schemas.judgment_schema import (
    JudgmentCorrectionResponse,
    JudgmentPendingResponse,
    JudgmentProgressResponse,
    JudgmentResponse,
)
from src.presentation.schemas.session_schema import (
    OutputResponse,
    OutputReviewItemResponse,
    SessionResponse,
    SubmitOutputResponse,
    TodayOutputsResponse,
)
from src.presentation.schemas.stats_schema import (
    DailyReportResponse,
    DailyReportSummaryResponse,
    WeeklyReportPointResponse,
    WeeklyReportResponse,
    WeeklyReportSummaryResponse,
)
from src.presentation.schemas.user_schema import UserProfileResponse
from src.presentation.schemas.user_settings_schema import UserSettingsResponse


def to_user_profile_response(view: UserProfileView) -> UserProfileResponse:
    return UserProfileResponse(
        id=view.id,
        firebase_uid=view.firebase_uid,
        auth_provider=view.auth_provider,
        display_name=view.display_name,
        age_group=view.age_group,
        onboarding_completed=view.onboarding_completed,
        created_at=view.created_at,
        updated_at=view.updated_at,
    )


def to_user_settings_response(view: UserSettingsView) -> UserSettingsResponse:
    return UserSettingsResponse(
        input_minutes=view.input_minutes,
        output_minutes=view.output_minutes,
        break_minutes=view.break_minutes,
        notification_enabled=view.notification_enabled,
        updated_at=view.updated_at,
    )


def to_session_response(view: SessionView) -> SessionResponse:
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


def to_submit_output_response(view: SubmitOutputView) -> SubmitOutputResponse:
    return SubmitOutputResponse(
        output=_to_output_response(view.output),
        status=view.status,
    )


def _to_output_response(view: OutputView) -> OutputResponse:
    return OutputResponse(
        id=view.id,
        session_id=view.session_id,
        kind=view.kind,
        content=view.content,
        image_url=view.image_url,
        submitted_at=view.submitted_at,
    )


def to_today_outputs_response(view: TodayOutputsView) -> TodayOutputsResponse:
    return TodayOutputsResponse(
        items=[
            OutputReviewItemResponse(
                session_id=item.session_id,
                output=_to_output_response(item.output),
                cycle_index=item.cycle_index,
                subject=item.subject,
                topic=item.topic,
                judgment=_to_optional_judgment_response(item.judgment),
            )
            for item in view.items
        ]
    )


def to_weekly_report_response(view: WeeklyReportView) -> WeeklyReportResponse:
    return WeeklyReportResponse(
        week_start=view.week_start,
        week_end=view.week_end,
        summary=WeeklyReportSummaryResponse(
            input_minutes=view.summary.input_minutes,
            output_minutes=view.summary.output_minutes,
            break_minutes=view.summary.break_minutes,
            total_study_minutes=view.summary.total_study_minutes,
            total_sessions=view.summary.total_sessions,
        ),
        points=[
            WeeklyReportPointResponse(
                bucket=point.bucket,
                label=point.label,
                study_minutes=point.study_minutes,
                sessions=point.sessions,
            )
            for point in view.points
        ],
        output_history=[
            OutputReviewItemResponse(
                session_id=item.session_id,
                output=_to_output_response(item.output),
                cycle_index=item.cycle_index,
                subject=item.subject,
                topic=item.topic,
                judgment=_to_optional_judgment_response(item.judgment),
            )
            for item in view.output_history
        ],
    )


def to_daily_report_response(view: DailyReportView) -> DailyReportResponse:
    return DailyReportResponse(
        date=view.date,
        summary=DailyReportSummaryResponse(
            input_minutes=view.summary.input_minutes,
            output_minutes=view.summary.output_minutes,
            break_minutes=view.summary.break_minutes,
            total_study_minutes=view.summary.total_study_minutes,
            total_sessions=view.summary.total_sessions,
        ),
        output_history=[
            OutputReviewItemResponse(
                session_id=item.session_id,
                output=_to_output_response(item.output),
                cycle_index=item.cycle_index,
                subject=item.subject,
                topic=item.topic,
                judgment=_to_optional_judgment_response(item.judgment),
            )
            for item in view.output_history
        ],
    )


def _to_optional_judgment_response(view: JudgmentView | None) -> JudgmentResponse | None:
    if view is None:
        return None
    return to_judgment_response(view)


def to_judgment_pending_response(view: JudgmentPendingView) -> JudgmentPendingResponse:
    return JudgmentPendingResponse(
        status=view.status,
        detail=view.detail,
        retry_after_seconds=view.retry_after_seconds,
        estimated_ready_at=view.estimated_ready_at,
    )


def to_judgment_progress_response(view: JudgmentProgressView) -> JudgmentProgressResponse:
    return JudgmentProgressResponse(
        status=view.status,
        stage=view.stage,
        percent=view.percent,
        message=view.message,
        updated_at=view.updated_at,
        completed_at=view.completed_at,
        error_code=view.error_code,
    )


def to_judgment_response(view: JudgmentView) -> JudgmentResponse:
    return JudgmentResponse(
        id=view.id,
        session_id=view.session_id,
        verdict=view.verdict,
        score=view.score,
        advice=view.advice,
        corrections=[
            JudgmentCorrectionResponse(
                target_text=correction.target_text,
                correct_text=correction.correct_text,
                explanation=correction.explanation,
                bbox=correction.bbox,
            )
            for correction in view.corrections
        ],
        judged_at=view.judged_at,
    )

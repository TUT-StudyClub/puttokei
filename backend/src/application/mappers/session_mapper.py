"""Session / Output と application DTO の変換。"""

from src.application.dto.session_dto import OutputView, SessionView
from src.domain.entities.output import Output
from src.domain.entities.session import Session
from src.domain.services.output_image_storage import OutputImageStorage
from src.domain.value_objects.output_kind import OutputKind


def to_session_view(session: Session) -> SessionView:
    """domain.Session を session view に変換する。"""
    return SessionView(
        id=session.id,
        user_id=session.user_id,
        status=session.status,
        subject=session.subject,
        topic=session.topic,
        input_minutes=session.input_minutes,
        output_minutes=session.output_minutes,
        break_minutes=session.break_minutes,
        started_at=session.started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
    )


def to_output_view(output: Output, *, image_url: str | None = None) -> OutputView:
    """domain.Output を output view に変換する。

    画像アウトプットの場合、`image_url` には GET 用の signed URL を渡す。
    """
    return OutputView(
        id=output.id,
        session_id=output.session_id,
        kind=output.kind,
        content=output.content,
        image_storage_path=output.image_storage_path,
        image_url=image_url,
        submitted_at=output.submitted_at,
    )


def resolve_output_view(
    output: Output,
    *,
    storage: OutputImageStorage | None,
    download_url_ttl_seconds: int,
) -> OutputView:
    """画像 output には signed URL を発行した上で OutputView を返す。"""
    image_url: str | None = None
    storage_path = output.image_storage_path
    if output.kind is OutputKind.IMAGE and storage_path is not None and storage is not None:
        image_url = storage.issue_download_url(
            storage_path=storage_path,
            ttl_seconds=download_url_ttl_seconds,
        )
    return to_output_view(output, image_url=image_url)

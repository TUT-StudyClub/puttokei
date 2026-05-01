"""判定進捗 DTO への変換。"""

from src.application.dto.judgment_dto import JudgmentProgressView
from src.domain.entities.judgment_progress import JudgmentProgress


def to_judgment_progress_view(progress: JudgmentProgress) -> JudgmentProgressView:
    """domain.JudgmentProgress を進捗 view に変換する。"""
    return JudgmentProgressView(
        session_id=progress.session_id,
        status=progress.status,
        stage=progress.stage,
        percent=progress.percent,
        message=progress.message,
        event_seq=progress.event_seq,
        updated_at=progress.updated_at,
        completed_at=progress.completed_at,
        error_code=progress.error_code,
    )

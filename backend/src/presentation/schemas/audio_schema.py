"""/api/v1/sessions/{id}/audio 系の Pydantic スキーマ。"""

from src.common.models import FrozenModel


class TranscribeAudioResponse(FrozenModel):
    """音声 → テキスト変換のレスポンス。"""

    transcript: str

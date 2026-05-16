"""SpeechToTextService のファクトリ。"""

from src.config import Settings
from src.domain.services.speech_to_text_service import SpeechToTextService
from src.infrastructure.speech.cloud_stt_service import CloudSttService
from src.infrastructure.speech.local_stt_service import LocalSttService


def build_speech_to_text_service(settings: Settings) -> SpeechToTextService:
    """Settings に応じた SpeechToTextService 実装を返す。"""
    if settings.stt_provider == "local":
        return LocalSttService()

    if settings.stt_provider == "cloud_speech":
        # Cloud STT の project は STT_PROJECT_ID 優先、未指定なら GCS_PROJECT_ID を流用。
        # GCS / Vertex AI と同じ GCP プロジェクトで運用する想定。
        project_id = settings.stt_project_id or settings.gcs_project_id
        if not project_id:
            raise ValueError(
                "STT_PROVIDER=cloud_speech の場合は STT_PROJECT_ID か "
                "GCS_PROJECT_ID が必要です。"
            )
        return CloudSttService(
            project_id=project_id,
            location=settings.stt_location,
            model=settings.stt_model,
            language=settings.stt_language,
            enable_punctuation=settings.stt_enable_punctuation,
            timeout_seconds=settings.stt_timeout_seconds,
            credentials_path=settings.stt_credentials_path,
            recognizer_id=settings.stt_recognizer_id,
        )

    raise ValueError(f"unsupported stt provider: {settings.stt_provider}")

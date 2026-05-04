"""音声 → テキスト変換の UseCase。

mobile から受け取った音声バイト列を Cloud STT で文字起こしし、
結果テキストを返すだけの薄い UseCase。判定 (LLM) には流さず、
mobile 側で表示・編集後に既存の text 提出フローを使う想定。
"""

from src.common.models import FrozenModel
from src.domain.services.speech_to_text_service import (
    AudioTooLargeError,
    SpeechToTextService,
    UnsupportedAudioFormatError,
)


class TranscribeAudioInput(FrozenModel):
    """文字起こしリクエストの入力 DTO。"""

    audio_bytes: bytes
    mime_type: str


class TranscribeAudioOutput(FrozenModel):
    """文字起こし結果の出力 DTO。"""

    transcript: str


class TranscribeAudio:
    """音声バイトを Cloud STT で文字起こしする UseCase。"""

    def __init__(
        self,
        *,
        speech_service: SpeechToTextService,
        max_bytes: int,
        allowed_mime_types: tuple[str, ...],
    ) -> None:
        self._speech_service = speech_service
        self._max_bytes = max_bytes
        self._allowed_mime_types = tuple(mt.lower() for mt in allowed_mime_types)

    async def execute(self, input_: TranscribeAudioInput) -> TranscribeAudioOutput:
        if len(input_.audio_bytes) == 0:
            raise UnsupportedAudioFormatError("音声バイト列が空です。")
        if len(input_.audio_bytes) > self._max_bytes:
            raise AudioTooLargeError(f"音声サイズが上限 {self._max_bytes} bytes を超えています。")
        if input_.mime_type.lower() not in self._allowed_mime_types:
            raise UnsupportedAudioFormatError(
                f"サポートされていない音声 MIME type です: {input_.mime_type}"
            )

        transcript = await self._speech_service.transcribe(
            audio_bytes=input_.audio_bytes,
            mime_type=input_.mime_type,
        )
        return TranscribeAudioOutput(transcript=transcript)

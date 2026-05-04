"""TranscribeAudio UseCase の振る舞い。"""

import pytest

from src.application.use_cases.transcribe_audio import (
    TranscribeAudio,
    TranscribeAudioInput,
)
from src.domain.services.speech_to_text_service import (
    AudioTooLargeError,
    SpeechToTextService,
    UnsupportedAudioFormatError,
)


class _StubSttService(SpeechToTextService):
    """transcribe を呼ばれた回数 / 引数を記録するスタブ。"""

    def __init__(self, transcript: str = "テスト文字起こし") -> None:
        self.transcript = transcript
        self.call_count = 0
        self.last_audio_bytes: bytes | None = None
        self.last_mime_type: str | None = None

    async def transcribe(self, *, audio_bytes: bytes, mime_type: str) -> str:
        self.call_count += 1
        self.last_audio_bytes = audio_bytes
        self.last_mime_type = mime_type
        return self.transcript


def _build_use_case(
    *,
    speech_service: SpeechToTextService | None = None,
    max_bytes: int = 1024,
    allowed_mime_types: tuple[str, ...] = ("audio/m4a", "audio/wav"),
) -> tuple[TranscribeAudio, _StubSttService]:
    stub = speech_service if isinstance(speech_service, _StubSttService) else _StubSttService()
    use_case = TranscribeAudio(
        speech_service=stub,
        max_bytes=max_bytes,
        allowed_mime_types=allowed_mime_types,
    )
    return use_case, stub


@pytest.mark.asyncio
async def test_returns_transcript_from_speech_service():
    use_case, stub = _build_use_case()

    result = await use_case.execute(
        TranscribeAudioInput(audio_bytes=b"\xff\xff\xff", mime_type="audio/m4a"),
    )

    assert result.transcript == "テスト文字起こし"
    assert stub.call_count == 1
    assert stub.last_audio_bytes == b"\xff\xff\xff"
    assert stub.last_mime_type == "audio/m4a"


@pytest.mark.asyncio
async def test_rejects_empty_audio_bytes():
    use_case, _ = _build_use_case()

    with pytest.raises(UnsupportedAudioFormatError):
        await use_case.execute(TranscribeAudioInput(audio_bytes=b"", mime_type="audio/m4a"))


@pytest.mark.asyncio
async def test_rejects_too_large_audio():
    use_case, stub = _build_use_case(max_bytes=10)

    with pytest.raises(AudioTooLargeError):
        await use_case.execute(
            TranscribeAudioInput(audio_bytes=b"x" * 11, mime_type="audio/m4a"),
        )
    assert stub.call_count == 0


@pytest.mark.asyncio
async def test_rejects_unsupported_mime_type():
    use_case, stub = _build_use_case(allowed_mime_types=("audio/m4a",))

    with pytest.raises(UnsupportedAudioFormatError):
        await use_case.execute(
            TranscribeAudioInput(audio_bytes=b"\xff", mime_type="audio/ogg"),
        )
    assert stub.call_count == 0


@pytest.mark.asyncio
async def test_mime_type_check_is_case_insensitive():
    """大文字 MIME type も許容することを担保する。"""
    use_case, stub = _build_use_case(allowed_mime_types=("audio/m4a",))

    result = await use_case.execute(
        TranscribeAudioInput(audio_bytes=b"\xff", mime_type="AUDIO/M4A"),
    )
    assert result.transcript == "テスト文字起こし"
    assert stub.call_count == 1

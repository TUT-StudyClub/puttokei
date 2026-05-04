"""LocalSttService の最小確認。"""

import pytest

from src.infrastructure.speech.local_stt_service import LocalSttService


@pytest.mark.asyncio
async def test_returns_default_mock_transcript():
    service = LocalSttService()
    transcript = await service.transcribe(audio_bytes=b"\xff", mime_type="audio/m4a")
    assert transcript != ""


@pytest.mark.asyncio
async def test_returns_custom_mock_transcript():
    service = LocalSttService(mock_transcript="任意の文字列")
    transcript = await service.transcribe(audio_bytes=b"", mime_type="anything")
    assert transcript == "任意の文字列"

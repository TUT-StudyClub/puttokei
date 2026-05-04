"""CloudSttService のユニットテスト。

`google.cloud.speech_v2.SpeechAsyncClient` を mock してネットワーク無しで、
リクエスト構築 / レスポンス変換 / エラー伝搬を検証する。
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.api_core import exceptions as gax_exceptions

from src.domain.services.speech_to_text_service import (
    SpeechToTextError,
    TranscriptionTimeoutError,
)
from src.infrastructure.speech.cloud_stt_service import CloudSttService


def _build_service_with_mocked_client(
    response: MagicMock,
    *,
    captured: dict[str, Any] | None = None,
    side_effect: BaseException | None = None,
) -> CloudSttService:
    """SpeechAsyncClient.recognize を mock した CloudSttService を返す。"""
    captured_dict = captured if captured is not None else {}

    async def fake_recognize(*, request: object) -> MagicMock:
        captured_dict["request"] = request
        if side_effect is not None:
            raise side_effect
        return response

    with patch(
        "src.infrastructure.speech.cloud_stt_service.speech_v2.SpeechAsyncClient"
    ) as mock_client_cls:
        client_instance = MagicMock()
        client_instance.recognize = AsyncMock(side_effect=fake_recognize)
        mock_client_cls.return_value = client_instance
        return CloudSttService(
            project_id="hourglass-f10ca",
            location="asia-southeast1",
            model="chirp_2",
            language="ja-JP",
            enable_punctuation=True,
            timeout_seconds=30,
            credentials_path=None,
        )


def _make_response(transcripts: list[str]) -> MagicMock:
    """RecognizeResponse 風のスタブを組み立てる。"""
    response = MagicMock()
    response.results = []
    for text in transcripts:
        result = MagicMock()
        alt = MagicMock()
        alt.transcript = text
        result.alternatives = [alt]
        response.results.append(result)
    return response


@pytest.mark.asyncio
async def test_transcribe_returns_concatenated_transcript():
    captured: dict[str, Any] = {}
    service = _build_service_with_mocked_client(
        _make_response(["こんにちは、", "今日は晴れです。"]),
        captured=captured,
    )

    transcript = await service.transcribe(audio_bytes=b"\xff\xff\xff", mime_type="audio/m4a")

    assert transcript == "こんにちは、 今日は晴れです。"

    request = captured["request"]
    assert request.recognizer == (
        "projects/hourglass-f10ca/locations/asia-southeast1/recognizers/_"
    )
    assert request.content == b"\xff\xff\xff"
    assert list(request.config.language_codes) == ["ja-JP"]
    assert request.config.model == "chirp_2"
    assert request.config.features.enable_automatic_punctuation is True


@pytest.mark.asyncio
async def test_transcribe_returns_empty_string_when_no_results():
    service = _build_service_with_mocked_client(_make_response([]))

    transcript = await service.transcribe(audio_bytes=b"\xff", mime_type="audio/m4a")
    assert transcript == ""


@pytest.mark.asyncio
async def test_transcribe_raises_timeout_error_on_asyncio_timeout():
    service = _build_service_with_mocked_client(
        _make_response([]),
        side_effect=TimeoutError(),
    )

    with pytest.raises(TranscriptionTimeoutError):
        await service.transcribe(audio_bytes=b"\xff", mime_type="audio/m4a")


@pytest.mark.asyncio
async def test_transcribe_raises_speech_error_on_google_api_error():
    service = _build_service_with_mocked_client(
        _make_response([]),
        side_effect=gax_exceptions.PermissionDenied("forbidden"),
    )

    with pytest.raises(SpeechToTextError):
        await service.transcribe(audio_bytes=b"\xff", mime_type="audio/m4a")

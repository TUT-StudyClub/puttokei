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
    location: str = "global",
    model: str = "latest_long",
    recognizer_id: str | None = None,
    captured: dict[str, Any] | None = None,
    side_effect: BaseException | None = None,
) -> tuple[CloudSttService, MagicMock]:
    """SpeechAsyncClient.recognize を mock した CloudSttService を返す。

    返り値の 2 つ目は SpeechAsyncClient のクラス mock。コンストラクタ呼び出しの
    引数 (credentials / client_options) を検証したいテストで利用する。
    """
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
        service = CloudSttService(
            project_id="hourglass-f10ca",
            location=location,
            model=model,
            language="ja-JP",
            enable_punctuation=True,
            timeout_seconds=30,
            credentials_path=None,
            recognizer_id=recognizer_id,
        )
        return service, mock_client_cls


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
async def test_transcribe_uses_ad_hoc_recognizer_at_global_by_default():
    captured: dict[str, Any] = {}
    service, mock_client_cls = _build_service_with_mocked_client(
        _make_response(["こんにちは、", "今日は晴れです。"]),
        captured=captured,
    )

    transcript = await service.transcribe(audio_bytes=b"\xff\xff\xff", mime_type="audio/m4a")

    assert transcript == "こんにちは、 今日は晴れです。"

    # ad-hoc recognizer (`_`) は global location で組み立てられる。
    request = captured["request"]
    assert request.recognizer == "projects/hourglass-f10ca/locations/global/recognizers/_"
    assert request.content == b"\xff\xff\xff"
    assert list(request.config.language_codes) == ["ja-JP"]
    assert request.config.model == "latest_long"
    assert request.config.features.enable_automatic_punctuation is True

    # client_options は ad-hoc + global の組み合わせでは指定しない (デフォルトで OK)。
    init_kwargs = mock_client_cls.call_args.kwargs
    assert init_kwargs.get("client_options") is None


@pytest.mark.asyncio
async def test_transcribe_targets_regional_endpoint_when_recognizer_id_provided():
    captured: dict[str, Any] = {}
    service, mock_client_cls = _build_service_with_mocked_client(
        _make_response(["chirp_2 の文字起こし結果"]),
        location="asia-southeast1",
        model="chirp_2",
        recognizer_id="puttokei-ja-chirp2",
        captured=captured,
    )

    transcript = await service.transcribe(audio_bytes=b"\xff", mime_type="audio/m4a")
    assert transcript == "chirp_2 の文字起こし結果"

    # 事前作成 recognizer の場合、リクエストは事前作成リソースの完全名を指す。
    request = captured["request"]
    assert request.recognizer == (
        "projects/hourglass-f10ca/locations/asia-southeast1/recognizers/puttokei-ja-chirp2"
    )

    # クライアントはリージョナル endpoint に向ける。
    init_kwargs = mock_client_cls.call_args.kwargs
    client_options = init_kwargs.get("client_options")
    assert client_options is not None
    assert client_options.api_endpoint == "asia-southeast1-speech.googleapis.com"


@pytest.mark.asyncio
async def test_transcribe_returns_empty_string_when_no_results():
    service, _ = _build_service_with_mocked_client(_make_response([]))

    transcript = await service.transcribe(audio_bytes=b"\xff", mime_type="audio/m4a")
    assert transcript == ""


@pytest.mark.asyncio
async def test_transcribe_raises_timeout_error_on_asyncio_timeout():
    service, _ = _build_service_with_mocked_client(
        _make_response([]),
        side_effect=TimeoutError(),
    )

    with pytest.raises(TranscriptionTimeoutError):
        await service.transcribe(audio_bytes=b"\xff", mime_type="audio/m4a")


@pytest.mark.asyncio
async def test_transcribe_raises_speech_error_on_google_api_error():
    service, _ = _build_service_with_mocked_client(
        _make_response([]),
        side_effect=gax_exceptions.PermissionDenied("forbidden"),
    )

    with pytest.raises(SpeechToTextError):
        await service.transcribe(audio_bytes=b"\xff", mime_type="audio/m4a")

"""`/api/v1/sessions/{id}/audio/transcribe` の API integration test。

conftest 経由で LocalSttService が mock されているので、固定文字列の
transcript が返ることを確認する。
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient


def _audio_form(
    *, content: bytes, filename: str = "audio.m4a", mime_type: str = "audio/m4a"
) -> dict[str, object]:
    return {"audio": (filename, content, mime_type)}


@pytest.mark.asyncio
async def test_transcribe_audio_returns_mock_transcript(client: AsyncClient):
    response = await client.post(
        f"/api/v1/sessions/{uuid4()}/audio/transcribe",
        headers={"Authorization": "Bearer audio-user"},
        files=_audio_form(content=b"\xff\xff\xff\xff"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["transcript"] == "テスト文字起こし"


@pytest.mark.asyncio
async def test_transcribe_audio_requires_authorization(client: AsyncClient):
    response = await client.post(
        f"/api/v1/sessions/{uuid4()}/audio/transcribe",
        files=_audio_form(content=b"\xff"),
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_transcribe_audio_rejects_unsupported_mime(client: AsyncClient):
    # text/plain は明らかに音声ファイルではないので 415 を返す想定。
    response = await client.post(
        f"/api/v1/sessions/{uuid4()}/audio/transcribe",
        headers={"Authorization": "Bearer audio-user"},
        files=_audio_form(content=b"hello", mime_type="text/plain"),
    )

    assert response.status_code == 415
    body = response.json()
    assert body["type"].endswith("unsupported_audio_format")


@pytest.mark.asyncio
async def test_transcribe_audio_rejects_empty_audio(client: AsyncClient):
    response = await client.post(
        f"/api/v1/sessions/{uuid4()}/audio/transcribe",
        headers={"Authorization": "Bearer audio-user"},
        files=_audio_form(content=b""),
    )

    assert response.status_code == 415
    body = response.json()
    assert body["type"].endswith("unsupported_audio_format")

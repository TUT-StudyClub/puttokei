"""`/api/v1/sessions/{id}/audio/transcribe` の API integration test。

conftest 経由で LocalSttService が mock されているので、固定文字列の
transcript が返ることを確認する。所有者検証は実 session を `POST /sessions`
で作って、別 uid で取得を試みるパターンで検証する。
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient


def _audio_form(
    *, content: bytes, filename: str = "audio.m4a", mime_type: str = "audio/m4a"
) -> dict[str, object]:
    return {"audio": (filename, content, mime_type)}


def _session_body() -> dict[str, object]:
    return {
        "subject": "英語",
        "topic": "関係代名詞",
        "input_minutes": 20,
        "output_minutes": 5,
        "break_minutes": 5,
    }


async def _create_session(client: AsyncClient, auth_uid: str) -> str:
    response = await client.post(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json=_session_body(),
    )
    assert response.status_code == 201
    return str(response.json()["id"])


@pytest.mark.asyncio
async def test_transcribe_audio_returns_mock_transcript(client: AsyncClient):
    session_id = await _create_session(client, "audio-user")

    response = await client.post(
        f"/api/v1/sessions/{session_id}/audio/transcribe",
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
async def test_transcribe_audio_returns_404_when_session_not_found(client: AsyncClient):
    response = await client.post(
        f"/api/v1/sessions/{uuid4()}/audio/transcribe",
        headers={"Authorization": "Bearer audio-user"},
        files=_audio_form(content=b"\xff"),
    )

    assert response.status_code == 404
    body = response.json()
    assert body["type"].endswith("session_not_found")


@pytest.mark.asyncio
async def test_transcribe_audio_rejects_other_users_session(client: AsyncClient):
    """他ユーザー所有の session_id を詐称した呼び出しは 404 で弾く。"""
    victim_session_id = await _create_session(client, "victim-user")

    response = await client.post(
        f"/api/v1/sessions/{victim_session_id}/audio/transcribe",
        headers={"Authorization": "Bearer attacker-user"},
        files=_audio_form(content=b"\xff"),
    )

    assert response.status_code == 404
    body = response.json()
    assert body["type"].endswith("session_not_found")


@pytest.mark.asyncio
async def test_transcribe_audio_rejects_unsupported_mime(client: AsyncClient):
    session_id = await _create_session(client, "audio-user")

    # text/plain は明らかに音声ファイルではないので 415 を返す想定。
    response = await client.post(
        f"/api/v1/sessions/{session_id}/audio/transcribe",
        headers={"Authorization": "Bearer audio-user"},
        files=_audio_form(content=b"hello", mime_type="text/plain"),
    )

    assert response.status_code == 415
    body = response.json()
    assert body["type"].endswith("unsupported_audio_format")


@pytest.mark.asyncio
async def test_transcribe_audio_rejects_empty_audio(client: AsyncClient):
    session_id = await _create_session(client, "audio-user")

    response = await client.post(
        f"/api/v1/sessions/{session_id}/audio/transcribe",
        headers={"Authorization": "Bearer audio-user"},
        files=_audio_form(content=b""),
    )

    assert response.status_code == 415
    body = response.json()
    assert body["type"].endswith("unsupported_audio_format")

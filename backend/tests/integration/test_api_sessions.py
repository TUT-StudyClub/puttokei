"""`/api/v1/sessions` の API integration test。

FakeAuthVerifier + FakeSessionRepository 経由で、実 DB / Firebase 無しで経路を検証する。
"""

import pytest
from httpx import AsyncClient


def _valid_body() -> dict[str, object]:
    return {
        "subject": "英語",
        "topic": "関係代名詞",
        "input_minutes": 20,
        "output_minutes": 5,
        "break_minutes": 5,
    }


@pytest.mark.asyncio
async def test_create_session_requires_authorization_header(client: AsyncClient):
    response = await client.post("/api/v1/sessions", json=_valid_body())
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_session_rejects_invalid_token(client: AsyncClient):
    response = await client.post(
        "/api/v1/sessions",
        headers={"Authorization": "Bearer invalid-token"},
        json=_valid_body(),
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_session_returns_201_with_session_view(client: AsyncClient):
    headers = {"Authorization": "Bearer user-001"}
    response = await client.post("/api/v1/sessions", headers=headers, json=_valid_body())

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "input"
    assert body["subject"] == "英語"
    assert body["topic"] == "関係代名詞"
    assert body["input_minutes"] == 20
    assert body["output_minutes"] == 5
    assert body["break_minutes"] == 5
    assert body["completed_at"] is None
    assert body["id"]
    assert body["user_id"]
    assert body["started_at"]
    assert body["created_at"]


@pytest.mark.asyncio
async def test_create_session_rejects_empty_subject(client: AsyncClient):
    headers = {"Authorization": "Bearer user-002"}
    payload = _valid_body() | {"subject": ""}
    response = await client.post("/api/v1/sessions", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_session_rejects_overlong_subject(client: AsyncClient):
    headers = {"Authorization": "Bearer user-003"}
    payload = _valid_body() | {"subject": "あ" * 51}
    response = await client.post("/api/v1/sessions", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_session_rejects_overlong_topic(client: AsyncClient):
    headers = {"Authorization": "Bearer user-004"}
    payload = _valid_body() | {"topic": "あ" * 201}
    response = await client.post("/api/v1/sessions", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_session_rejects_zero_minutes(client: AsyncClient):
    headers = {"Authorization": "Bearer user-005"}
    payload = _valid_body() | {"input_minutes": 0}
    response = await client.post("/api/v1/sessions", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_session_rejects_too_long_minutes(client: AsyncClient):
    headers = {"Authorization": "Bearer user-006"}
    payload = _valid_body() | {"input_minutes": 121}
    response = await client.post("/api/v1/sessions", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_session_forbids_extra_fields(client: AsyncClient):
    headers = {"Authorization": "Bearer user-007"}
    payload = _valid_body() | {"unknown": "x"}
    response = await client.post("/api/v1/sessions", headers=headers, json=payload)
    assert response.status_code == 422

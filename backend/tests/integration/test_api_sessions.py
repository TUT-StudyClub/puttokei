"""`/api/v1/sessions` の API integration test。

FakeAuthVerifier + FakeSessionRepository 経由で、実 DB / Firebase 無しで経路を検証する。
"""

from uuid import uuid4

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


async def _create_session(client: AsyncClient, auth_uid: str) -> dict[str, object]:
    """PATCH テストで使うための helper。POST で session を作って body を返す。

    FakeAuthVerifier は Authorization 値をそのまま Firebase UID として解釈するため、
    ここで渡す auth_uid がユーザー ID の代わりになる。
    """
    response = await client.post(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json=_valid_body(),
    )
    assert response.status_code == 201
    return response.json()


async def _advance_status(
    client: AsyncClient, auth_uid: str, session_id: str, new_status: str
) -> dict[str, object]:
    """テスト内で status を順送りするための helper。"""
    response = await client.patch(
        f"/api/v1/sessions/{session_id}",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"status": new_status},
    )
    assert response.status_code == 200
    return response.json()


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


# --- PATCH /sessions/{id} (Issue #41) ---


@pytest.mark.asyncio
async def test_update_session_requires_authorization_header(client: AsyncClient):
    created = await _create_session(client, "patch-user-001")
    response = await client.patch(
        f"/api/v1/sessions/{created['id']}",
        json={"status": "output"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_session_rejects_invalid_token(client: AsyncClient):
    created = await _create_session(client, "patch-user-002")
    response = await client.patch(
        f"/api/v1/sessions/{created['id']}",
        headers={"Authorization": "Bearer invalid-token"},
        json={"status": "output"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_session_returns_404_for_unknown_session(client: AsyncClient):
    response = await client.patch(
        f"/api/v1/sessions/{uuid4()}",
        headers={"Authorization": "Bearer patch-user-003"},
        json={"status": "output"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_session_returns_404_for_other_users_session(client: AsyncClient):
    created = await _create_session(client, "patch-user-owner")
    response = await client.patch(
        f"/api/v1/sessions/{created['id']}",
        headers={"Authorization": "Bearer patch-user-other"},
        json={"status": "output"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_session_advances_input_to_output(client: AsyncClient):
    auth_uid = "patch-user-flow-1"
    created = await _create_session(client, auth_uid)
    response = await client.patch(
        f"/api/v1/sessions/{created['id']}",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"status": "output"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "output"
    # output 遷移時点では completed_at はセットされない
    assert body["completed_at"] is None


@pytest.mark.asyncio
async def test_update_session_full_happy_path_sets_completed_at_on_judged(
    client: AsyncClient,
):
    """input → output → judging → judged まで順送りする正常パス。"""
    auth_uid = "patch-user-flow-2"
    created = await _create_session(client, auth_uid)
    session_id = created["id"]

    await _advance_status(client, auth_uid, session_id, "output")
    await _advance_status(client, auth_uid, session_id, "judging")
    judged = await _advance_status(client, auth_uid, session_id, "judged")

    assert judged["status"] == "judged"
    assert judged["completed_at"] is not None


@pytest.mark.asyncio
async def test_update_session_cancelled_sets_completed_at(client: AsyncClient):
    auth_uid = "patch-user-flow-3"
    created = await _create_session(client, auth_uid)
    response = await client.patch(
        f"/api/v1/sessions/{created['id']}",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"status": "cancelled"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "cancelled"
    assert body["completed_at"] is not None


@pytest.mark.asyncio
async def test_update_session_rejects_skip_transition(client: AsyncClient):
    auth_uid = "patch-user-flow-4"
    created = await _create_session(client, auth_uid)
    response = await client.patch(
        f"/api/v1/sessions/{created['id']}",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"status": "judged"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_session_rejects_no_op_transition(client: AsyncClient):
    auth_uid = "patch-user-flow-5"
    created = await _create_session(client, auth_uid)
    response = await client.patch(
        f"/api/v1/sessions/{created['id']}",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"status": "input"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_session_rejects_transition_after_judged(client: AsyncClient):
    auth_uid = "patch-user-flow-6"
    created = await _create_session(client, auth_uid)
    session_id = created["id"]
    await _advance_status(client, auth_uid, session_id, "output")
    await _advance_status(client, auth_uid, session_id, "judging")
    await _advance_status(client, auth_uid, session_id, "judged")

    response = await client.patch(
        f"/api/v1/sessions/{session_id}",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"status": "cancelled"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_session_rejects_unknown_status_value(client: AsyncClient):
    auth_uid = "patch-user-flow-7"
    created = await _create_session(client, auth_uid)
    response = await client.patch(
        f"/api/v1/sessions/{created['id']}",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"status": "unknown"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_session_rejects_extra_fields(client: AsyncClient):
    auth_uid = "patch-user-flow-8"
    created = await _create_session(client, auth_uid)
    response = await client.patch(
        f"/api/v1/sessions/{created['id']}",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"status": "output", "unknown": "x"},
    )
    assert response.status_code == 422

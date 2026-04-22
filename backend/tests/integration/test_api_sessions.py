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


async def _submit_output(
    client: AsyncClient,
    auth_uid: str,
    session_id: str,
    *,
    content: str = "関係代名詞は先行詞を修飾し、文中の名詞を詳しく説明する表現です。",
    submitted_at: str = "2026-04-10T15:25:00Z",
):
    return await client.post(
        f"/api/v1/sessions/{session_id}/output",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"content": content, "submitted_at": submitted_at},
    )


def _assert_problem_details(
    body: dict[str, object],
    *,
    expected_status: int,
    expected_type: str,
) -> None:
    assert body["status"] == expected_status
    assert body["type"] == expected_type
    assert body["title"]
    assert body["instance"]


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
    _assert_problem_details(
        response.json(),
        expected_status=401,
        expected_type="authentication_error",
    )


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
    _assert_problem_details(
        response.json(),
        expected_status=422,
        expected_type="validation_error",
    )


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
    _assert_problem_details(
        response.json(),
        expected_status=404,
        expected_type="session_not_found",
    )


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


# --- POST /sessions/{id}/output (Issue #51) ---


@pytest.mark.asyncio
async def test_submit_output_requires_authorization_header(client: AsyncClient):
    created = await _create_session(client, "submit-user-001")
    await _advance_status(client, "submit-user-001", created["id"], "output")

    response = await client.post(
        f"/api/v1/sessions/{created['id']}/output",
        json={
            "content": "本文です",
            "submitted_at": "2026-04-10T15:25:00Z",
        },
    )

    assert response.status_code == 401
    _assert_problem_details(
        response.json(),
        expected_status=401,
        expected_type="authentication_required",
    )


@pytest.mark.asyncio
async def test_submit_output_returns_202_and_updates_status_to_judging(client: AsyncClient):
    auth_uid = "submit-user-002"
    created = await _create_session(client, auth_uid)
    session_id = created["id"]
    await _advance_status(client, auth_uid, session_id, "output")

    response = await _submit_output(client, auth_uid, session_id)

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "judging"
    assert body["output"]["session_id"] == session_id
    assert body["output"]["content"].startswith("関係代名詞")


@pytest.mark.asyncio
async def test_submit_output_returns_404_for_other_users_session(client: AsyncClient):
    created = await _create_session(client, "submit-user-owner")
    await _advance_status(client, "submit-user-owner", created["id"], "output")

    response = await _submit_output(client, "submit-user-other", created["id"])

    assert response.status_code == 404
    _assert_problem_details(
        response.json(),
        expected_status=404,
        expected_type="session_not_found",
    )


@pytest.mark.asyncio
async def test_submit_output_rejects_invalid_session_state(client: AsyncClient):
    created = await _create_session(client, "submit-user-003")

    response = await _submit_output(client, "submit-user-003", created["id"])

    assert response.status_code == 409
    _assert_problem_details(
        response.json(),
        expected_status=409,
        expected_type="invalid_session_state",
    )


@pytest.mark.asyncio
async def test_submit_output_allows_resubmission_and_overwrites_existing_output(
    client: AsyncClient,
):
    """1 セッション 1 アウトプット制約と重複送信時の上書き挙動を固定する。"""
    auth_uid = "submit-user-005"
    created = await _create_session(client, auth_uid)
    session_id = created["id"]
    await _advance_status(client, auth_uid, session_id, "output")

    first = await _submit_output(
        client,
        auth_uid,
        session_id,
        content="1 回目の本文です。関係代名詞の復習をここに書きます。",
        submitted_at="2026-04-10T15:25:00Z",
    )
    assert first.status_code == 202

    second = await _submit_output(
        client,
        auth_uid,
        session_id,
        content="2 回目の本文です。内容を書き直しました。",
        submitted_at="2026-04-10T15:30:00Z",
    )

    assert second.status_code == 202
    first_body = first.json()
    second_body = second.json()
    # JUDGING からの再送でも受理され、status は judging のまま
    # (SubmitOutput の update スキップ分岐)
    assert second_body["status"] == "judging"
    assert second_body["output"]["session_id"] == session_id
    # UNIQUE(session_id) と upsert により output.id は再利用される
    assert second_body["output"]["id"] == first_body["output"]["id"]
    # content / submitted_at は 2 回目の値で上書きされる
    assert second_body["output"]["content"] == "2 回目の本文です。内容を書き直しました。"
    assert second_body["output"]["submitted_at"].startswith("2026-04-10T15:30:00")


@pytest.mark.asyncio
async def test_submit_output_rejects_blank_content_with_problem_details(client: AsyncClient):
    auth_uid = "submit-user-004"
    created = await _create_session(client, auth_uid)
    await _advance_status(client, auth_uid, created["id"], "output")

    response = await client.post(
        f"/api/v1/sessions/{created['id']}/output",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={
            "content": "   ",
            "submitted_at": "2026-04-10T15:25:00Z",
        },
    )

    assert response.status_code == 422
    _assert_problem_details(
        response.json(),
        expected_status=422,
        expected_type="validation_error",
    )


# --- GET /sessions/{id}/judgment (Issue #51) ---


@pytest.mark.asyncio
async def test_get_judgment_returns_202_while_pending(client: AsyncClient):
    auth_uid = "judgment-user-001"
    created = await _create_session(client, auth_uid)
    session_id = created["id"]
    await _advance_status(client, auth_uid, session_id, "output")
    await _submit_output(
        client,
        auth_uid,
        session_id,
        submitted_at="2099-04-10T15:25:00Z",
    )

    response = await client.get(
        f"/api/v1/sessions/{session_id}/judgment",
        headers={"Authorization": f"Bearer {auth_uid}"},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "pending"
    assert body["retry_after_seconds"] >= 1
    assert response.headers["Retry-After"]


@pytest.mark.asyncio
async def test_get_judgment_returns_rejected_verdict_for_short_content(client: AsyncClient):
    auth_uid = "judgment-user-002"
    created = await _create_session(client, auth_uid)
    session_id = created["id"]
    await _advance_status(client, auth_uid, session_id, "output")
    await _submit_output(
        client,
        auth_uid,
        session_id,
        content="短いです",
        submitted_at="2020-04-10T15:25:00Z",
    )

    response = await client.get(
        f"/api/v1/sessions/{session_id}/judgment",
        headers={"Authorization": f"Bearer {auth_uid}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["verdict"] == "rejected"
    assert body["score"] == 0
    assert "学習内容" in body["advice"]


@pytest.mark.asyncio
async def test_get_judgment_returns_ready_judgment_for_past_submission(client: AsyncClient):
    auth_uid = "judgment-user-003"
    created = await _create_session(client, auth_uid)
    session_id = created["id"]
    await _advance_status(client, auth_uid, session_id, "output")
    await _submit_output(
        client,
        auth_uid,
        session_id,
        content=(
            "関係代名詞は先行詞を詳しく説明する節を作るために使います。"
            "who は人、which は物に使い、that はどちらにも使えることがあります。"
            "主節と従属節の関係を意識すると理解しやすいです。"
        ),
        submitted_at="2020-04-10T15:25:00Z",
    )

    response = await client.get(
        f"/api/v1/sessions/{session_id}/judgment",
        headers={"Authorization": f"Bearer {auth_uid}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["verdict"] in {"correct", "partial"}
    assert body["items"]
    assert body["judged_at"]


@pytest.mark.asyncio
async def test_get_judgment_returns_409_when_output_not_submitted(client: AsyncClient):
    auth_uid = "judgment-user-004"
    created = await _create_session(client, auth_uid)
    await _advance_status(client, auth_uid, created["id"], "output")
    await _advance_status(client, auth_uid, created["id"], "judging")

    response = await client.get(
        f"/api/v1/sessions/{created['id']}/judgment",
        headers={"Authorization": f"Bearer {auth_uid}"},
    )

    assert response.status_code == 409
    _assert_problem_details(
        response.json(),
        expected_status=409,
        expected_type="output_not_submitted",
    )

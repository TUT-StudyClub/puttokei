"""`/api/v1/stats` の API integration test。"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from src.domain.entities.judgment import Judgment
from src.domain.value_objects.verdict import Verdict
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository


def _session_body(
    *,
    subject: str = "英語",
    topic: str = "関係代名詞",
    input_minutes: int = 20,
    output_minutes: int = 5,
    break_minutes: int = 5,
) -> dict[str, object]:
    return {
        "subject": subject,
        "topic": topic,
        "input_minutes": input_minutes,
        "output_minutes": output_minutes,
        "break_minutes": break_minutes,
    }


async def _create_session(
    client: AsyncClient,
    auth_uid: str,
    *,
    subject: str = "英語",
    topic: str = "関係代名詞",
    input_minutes: int = 20,
    output_minutes: int = 5,
    break_minutes: int = 5,
) -> dict[str, object]:
    response = await client.post(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json=_session_body(
            subject=subject,
            topic=topic,
            input_minutes=input_minutes,
            output_minutes=output_minutes,
            break_minutes=break_minutes,
        ),
    )
    assert response.status_code == 201
    return response.json()


async def _advance_status(client: AsyncClient, auth_uid: str, session_id: str) -> None:
    response = await client.patch(
        f"/api/v1/sessions/{session_id}",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"status": "output"},
    )
    assert response.status_code == 200


async def _submit_output(
    client: AsyncClient,
    auth_uid: str,
    session_id: str,
    *,
    content: str,
    submitted_at: str,
) -> None:
    response = await client.post(
        f"/api/v1/sessions/{session_id}/outputs/text",
        headers={"Authorization": f"Bearer {auth_uid}"},
        json={"content": content, "submitted_at": submitted_at},
    )
    assert response.status_code == 202


async def _create_session_with_output(
    client: AsyncClient,
    auth_uid: str,
    *,
    subject: str,
    topic: str,
    input_minutes: int,
    output_minutes: int,
    break_minutes: int,
    content: str,
    submitted_at: str,
) -> dict[str, object]:
    session = await _create_session(
        client,
        auth_uid,
        subject=subject,
        topic=topic,
        input_minutes=input_minutes,
        output_minutes=output_minutes,
        break_minutes=break_minutes,
    )
    session_id = str(session["id"])
    await _advance_status(client, auth_uid, session_id)
    await _submit_output(
        client,
        auth_uid,
        session_id,
        content=content,
        submitted_at=submitted_at,
    )
    return session


@pytest.mark.asyncio
async def test_get_weekly_report_returns_current_users_weekly_outputs(
    client: AsyncClient,
    fake_judgment_repository: FakeJudgmentRepository,
):
    auth_uid = "weekly-report-user"
    first = await _create_session_with_output(
        client,
        auth_uid,
        subject="英語",
        topic="関係代名詞",
        input_minutes=20,
        output_minutes=5,
        break_minutes=5,
        content="日曜のアウトプットです。",
        submitted_at="2026-04-26T01:00:00Z",
    )
    await _create_session_with_output(
        client,
        auth_uid,
        subject="国語",
        topic="随筆",
        input_minutes=30,
        output_minutes=15,
        break_minutes=10,
        content="月曜のアウトプットです。",
        submitted_at="2026-04-27T02:00:00Z",
    )
    await _create_session_with_output(
        client,
        auth_uid,
        subject="数学",
        topic="二次関数",
        input_minutes=60,
        output_minutes=10,
        break_minutes=5,
        content="前週のアウトプットです。",
        submitted_at="2026-04-25T14:59:59Z",
    )
    await _create_session_with_output(
        client,
        "weekly-report-other-user",
        subject="理科",
        topic="化学",
        input_minutes=40,
        output_minutes=10,
        break_minutes=5,
        content="別ユーザーのアウトプットです。",
        submitted_at="2026-04-26T03:00:00Z",
    )
    await fake_judgment_repository.add(
        Judgment(
            id=uuid4(),
            session_id=UUID(str(first["id"])),
            verdict=Verdict.PARTIAL,
            score=80,
            advice="要点は整理できています。",
            corrections=[],
            judged_at=datetime.now(UTC),
        )
    )

    response = await client.get(
        "/api/v1/stats/weekly?week_start=2026-04-26",
        headers={"Authorization": f"Bearer {auth_uid}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["week_start"] == "2026-04-26"
    assert body["week_end"] == "2026-05-02"
    assert body["summary"] == {
        "input_minutes": 50,
        "output_minutes": 20,
        "break_minutes": 15,
        "total_study_minutes": 70,
        "total_sessions": 2,
    }
    assert [point["bucket"] for point in body["points"]] == [
        "2026-04-26",
        "2026-04-27",
        "2026-04-28",
        "2026-04-29",
        "2026-04-30",
        "2026-05-01",
        "2026-05-02",
    ]
    assert [point["study_minutes"] for point in body["points"]] == [25, 45, 0, 0, 0, 0, 0]
    assert [point["sessions"] for point in body["points"]] == [1, 1, 0, 0, 0, 0, 0]
    assert [item["output"]["content"] for item in body["output_history"]] == [
        "日曜のアウトプットです。",
        "月曜のアウトプットです。",
    ]
    assert body["output_history"][0]["judgment"]["score"] == 80
    assert body["output_history"][1]["judgment"] is None


@pytest.mark.asyncio
async def test_get_weekly_report_returns_zero_filled_empty_week(client: AsyncClient):
    response = await client.get(
        "/api/v1/stats/weekly?week_start=2026-04-26",
        headers={"Authorization": "Bearer empty-week-user"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["total_sessions"] == 0
    assert len(body["points"]) == 7
    assert all(point["study_minutes"] == 0 for point in body["points"])
    assert body["output_history"] == []

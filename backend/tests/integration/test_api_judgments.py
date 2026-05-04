"""`/api/v1/judgments` の API integration test。"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from src.domain.entities.judgment import Judgment, JudgmentCorrection
from src.domain.value_objects.verdict import Verdict
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository


def _valid_session_body() -> dict[str, object]:
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
        json=_valid_session_body(),
    )
    assert response.status_code == 201
    return str(response.json()["id"])


async def _add_judgment(
    judgments: FakeJudgmentRepository,
    *,
    session_id: str,
    verdict: Verdict,
    score: int,
    judged_at: datetime,
    advice: str = "保存済みの判定結果です。",
) -> UUID:
    judgment_id = uuid4()
    await judgments.add(
        Judgment(
            id=judgment_id,
            session_id=UUID(session_id),
            verdict=verdict,
            score=score,
            advice=advice,
            corrections=[
                JudgmentCorrection(
                    target_text="whoは人以外にも使える",
                    correct_text="who は人に対して使い、人以外には which を使う",
                    explanation="who は人を表す先行詞に使います。",
                )
            ],
            judged_at=judged_at,
        )
    )
    return judgment_id


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
async def test_list_judgments_returns_authenticated_users_items_sorted_desc(
    client: AsyncClient,
    fake_judgment_repository: FakeJudgmentRepository,
):
    owner_auth = "judgment-list-owner"
    old_session_id = await _create_session(client, owner_auth)
    latest_session_id = await _create_session(client, owner_auth)
    other_session_id = await _create_session(client, "judgment-list-other")

    old_id = await _add_judgment(
        fake_judgment_repository,
        session_id=old_session_id,
        verdict=Verdict.PARTIAL,
        score=72,
        judged_at=datetime(2026, 5, 1, 9, 0, tzinfo=UTC),
    )
    latest_id = await _add_judgment(
        fake_judgment_repository,
        session_id=latest_session_id,
        verdict=Verdict.CORRECT,
        score=96,
        judged_at=datetime(2026, 5, 2, 9, 0, tzinfo=UTC),
    )
    await _add_judgment(
        fake_judgment_repository,
        session_id=other_session_id,
        verdict=Verdict.INCORRECT,
        score=30,
        judged_at=datetime(2026, 5, 3, 9, 0, tzinfo=UTC),
    )

    response = await client.get(
        "/api/v1/judgments",
        headers={"Authorization": f"Bearer {owner_auth}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["judgments"]] == [str(latest_id), str(old_id)]
    assert body["next_cursor"] is None


@pytest.mark.asyncio
async def test_list_judgments_filters_verdict_and_date_then_sorts_asc(
    client: AsyncClient,
    fake_judgment_repository: FakeJudgmentRepository,
):
    auth_uid = "judgment-filter-owner"
    first_session_id = await _create_session(client, auth_uid)
    second_session_id = await _create_session(client, auth_uid)
    ignored_verdict_session_id = await _create_session(client, auth_uid)
    ignored_date_session_id = await _create_session(client, auth_uid)

    first_id = await _add_judgment(
        fake_judgment_repository,
        session_id=first_session_id,
        verdict=Verdict.PARTIAL,
        score=70,
        judged_at=datetime(2026, 5, 2, 9, 0, tzinfo=UTC),
    )
    second_id = await _add_judgment(
        fake_judgment_repository,
        session_id=second_session_id,
        verdict=Verdict.PARTIAL,
        score=82,
        judged_at=datetime(2026, 5, 3, 9, 0, tzinfo=UTC),
    )
    await _add_judgment(
        fake_judgment_repository,
        session_id=ignored_verdict_session_id,
        verdict=Verdict.CORRECT,
        score=100,
        judged_at=datetime(2026, 5, 2, 12, 0, tzinfo=UTC),
    )
    await _add_judgment(
        fake_judgment_repository,
        session_id=ignored_date_session_id,
        verdict=Verdict.PARTIAL,
        score=65,
        judged_at=datetime(2026, 5, 5, 9, 0, tzinfo=UTC),
    )

    response = await client.get(
        "/api/v1/judgments",
        headers={"Authorization": f"Bearer {auth_uid}"},
        params={
            "verdict": "partial",
            "judged_from": "2026-05-02T00:00:00+00:00",
            "judged_to": "2026-05-04T00:00:00+00:00",
            "sort": "judged_at_asc",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["judgments"]] == [str(first_id), str(second_id)]


@pytest.mark.asyncio
async def test_list_judgments_paginates_with_next_cursor(
    client: AsyncClient,
    fake_judgment_repository: FakeJudgmentRepository,
):
    auth_uid = "judgment-pagination-owner"
    session_ids = [await _create_session(client, auth_uid) for _ in range(3)]
    judgment_ids = []
    for index, session_id in enumerate(session_ids, start=1):
        judgment_ids.append(
            await _add_judgment(
                fake_judgment_repository,
                session_id=session_id,
                verdict=Verdict.PARTIAL,
                score=60 + index,
                judged_at=datetime(2026, 5, index, 9, 0, tzinfo=UTC),
            )
        )

    first_response = await client.get(
        "/api/v1/judgments",
        headers={"Authorization": f"Bearer {auth_uid}"},
        params={"limit": "2"},
    )

    assert first_response.status_code == 200
    first_body = first_response.json()
    assert [item["id"] for item in first_body["judgments"]] == [
        str(judgment_ids[2]),
        str(judgment_ids[1]),
    ]
    assert first_body["next_cursor"]

    second_response = await client.get(
        "/api/v1/judgments",
        headers={"Authorization": f"Bearer {auth_uid}"},
        params={"limit": "2", "cursor": first_body["next_cursor"]},
    )

    assert second_response.status_code == 200
    second_body = second_response.json()
    assert [item["id"] for item in second_body["judgments"]] == [str(judgment_ids[0])]
    assert second_body["next_cursor"] is None


@pytest.mark.asyncio
async def test_list_judgments_rejects_invalid_cursor(client: AsyncClient):
    response = await client.get(
        "/api/v1/judgments",
        headers={"Authorization": "Bearer judgment-invalid-cursor"},
        params={"cursor": "not-a-cursor"},
    )

    assert response.status_code == 400
    _assert_problem_details(
        response.json(),
        expected_status=400,
        expected_type="invalid_cursor",
    )


@pytest.mark.asyncio
async def test_get_judgment_detail_returns_wrapped_judgment(
    client: AsyncClient,
    fake_judgment_repository: FakeJudgmentRepository,
):
    auth_uid = "judgment-detail-owner"
    session_id = await _create_session(client, auth_uid)
    judgment_id = await _add_judgment(
        fake_judgment_repository,
        session_id=session_id,
        verdict=Verdict.CORRECT,
        score=95,
        judged_at=datetime(2026, 5, 3, 9, 0, tzinfo=UTC),
    )

    response = await client.get(
        f"/api/v1/judgments/{judgment_id}",
        headers={"Authorization": f"Bearer {auth_uid}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["judgment"]["id"] == str(judgment_id)
    assert body["judgment"]["score"] == 95


@pytest.mark.asyncio
async def test_get_judgment_detail_returns_404_for_other_user(
    client: AsyncClient,
    fake_judgment_repository: FakeJudgmentRepository,
):
    owner_auth = "judgment-detail-owner-private"
    session_id = await _create_session(client, owner_auth)
    judgment_id = await _add_judgment(
        fake_judgment_repository,
        session_id=session_id,
        verdict=Verdict.PARTIAL,
        score=72,
        judged_at=datetime(2026, 5, 3, 9, 0, tzinfo=UTC),
    )

    response = await client.get(
        f"/api/v1/judgments/{judgment_id}",
        headers={"Authorization": "Bearer judgment-detail-other"},
    )

    assert response.status_code == 404
    _assert_problem_details(
        response.json(),
        expected_status=404,
        expected_type="judgment_not_found",
    )

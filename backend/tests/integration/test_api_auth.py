"""`/api/v1/auth/verify` の API integration test。

FakeAuthVerifier + FakeUserRepository 経由で、実 DB / Firebase 無しに経路を検証する。
要件書 3.2.1 / 6.1 に対応する。
"""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from tests.fakes.fake_user_repository import FakeUserRepository


@pytest.mark.asyncio
async def test_verify_requires_authorization_header(client: AsyncClient):
    response = await client.post("/api/v1/auth/verify")
    assert response.status_code == 401
    body = response.json()
    assert body["type"].endswith("authentication_required")
    assert response.headers.get("WWW-Authenticate") == "Bearer"


@pytest.mark.asyncio
async def test_verify_rejects_invalid_token(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/verify",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401
    body = response.json()
    assert body["type"].endswith("authentication_error")


@pytest.mark.asyncio
async def test_verify_rejects_unsupported_sign_in_provider(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/verify",
        headers={"Authorization": "Bearer github-user:github.com"},
    )
    assert response.status_code == 401
    body = response.json()
    assert body["type"].endswith("unsupported_sign_in_provider")


@pytest.mark.asyncio
async def test_verify_creates_new_user_on_first_call(
    client: AsyncClient, fake_user_repository: FakeUserRepository
):
    response = await client.post(
        "/api/v1/auth/verify",
        headers={"Authorization": "Bearer new-user:apple.com"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["is_new"] is True
    assert body["user"]["firebase_uid"] == "new-user"
    assert body["user"]["auth_provider"] == "apple"
    assert body["user"]["display_name"] is None
    assert body["user"]["age_group"] is None
    assert body["user"]["onboarding_completed"] is False
    assert "id" in body["user"]
    assert "created_at" in body["user"]
    assert "updated_at" in body["user"]

    # fake repo に実際に追加されていること
    stored = await fake_user_repository.find_by_firebase_uid("new-user")
    assert stored is not None
    assert stored.firebase_uid == "new-user"


@pytest.mark.asyncio
async def test_verify_creates_anonymous_user(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/verify",
        headers={"Authorization": "Bearer anonymous-user:anonymous"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["is_new"] is True
    assert body["user"]["firebase_uid"] == "anonymous-user"
    assert body["user"]["auth_provider"] == "anonymous"


@pytest.mark.asyncio
async def test_verify_returns_existing_user_on_second_call(client: AsyncClient):
    headers = {"Authorization": "Bearer existing-user"}

    first = await client.post("/api/v1/auth/verify", headers=headers)
    assert first.status_code == 200
    assert first.json()["is_new"] is True

    second = await client.post("/api/v1/auth/verify", headers=headers)
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["is_new"] is False
    assert second_body["user"]["firebase_uid"] == "existing-user"
    # 1 回目と同じ internal id が返ること
    assert second_body["user"]["id"] == first.json()["user"]["id"]


@pytest.mark.asyncio
async def test_verify_rejects_deleted_account(
    client: AsyncClient, fake_user_repository: FakeUserRepository
):
    # あらかじめ repo に「削除済み」ユーザーをセットしておく
    headers = {"Authorization": "Bearer deleted-user"}
    create_response = await client.post("/api/v1/auth/verify", headers=headers)
    assert create_response.status_code == 200

    # 論理削除状態に書き換える
    existing = await fake_user_repository.find_by_firebase_uid("deleted-user")
    assert existing is not None
    fake_user_repository.users["deleted-user"] = existing.with_deleted_at(
        deleted_at=datetime.now(UTC),
    )

    response = await client.post("/api/v1/auth/verify", headers=headers)
    assert response.status_code == 401
    body = response.json()
    assert body["type"].endswith("authentication_required")

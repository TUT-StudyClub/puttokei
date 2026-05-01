"""`PUT /api/v1/users/me/push-token` の API integration test。"""

import pytest
from httpx import AsyncClient

from tests.fakes.fake_user_repository import FakeUserRepository


@pytest.mark.asyncio
async def test_put_push_token_requires_authorization_header(client: AsyncClient):
    response = await client.put("/api/v1/users/me/push-token", json={"fcm_token": "abc"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_put_push_token_persists_token(
    client: AsyncClient, fake_user_repository: FakeUserRepository
):
    headers = {"Authorization": "Bearer push-user-001"}
    # 初回 GET で AuthenticateUser に user を作らせる
    await client.get("/api/v1/users/me/settings", headers=headers)

    response = await client.put(
        "/api/v1/users/me/push-token",
        headers=headers,
        json={"fcm_token": "fcm-test-token"},
    )

    assert response.status_code == 204
    assert response.text == ""
    assert fake_user_repository.users["push-user-001"].fcm_token == "fcm-test-token"  # noqa: S105


@pytest.mark.asyncio
async def test_put_push_token_accepts_null_to_clear(
    client: AsyncClient, fake_user_repository: FakeUserRepository
):
    headers = {"Authorization": "Bearer push-user-002"}
    await client.get("/api/v1/users/me/settings", headers=headers)

    # まずトークンをセットしてから null でクリアする
    await client.put(
        "/api/v1/users/me/push-token",
        headers=headers,
        json={"fcm_token": "to-be-cleared"},
    )
    assert fake_user_repository.users["push-user-002"].fcm_token == "to-be-cleared"  # noqa: S105

    response = await client.put(
        "/api/v1/users/me/push-token",
        headers=headers,
        json={"fcm_token": None},
    )

    assert response.status_code == 204
    assert fake_user_repository.users["push-user-002"].fcm_token is None


@pytest.mark.asyncio
async def test_put_push_token_rejects_empty_string(client: AsyncClient):
    headers = {"Authorization": "Bearer push-user-empty"}
    await client.get("/api/v1/users/me/settings", headers=headers)

    response = await client.put(
        "/api/v1/users/me/push-token",
        headers=headers,
        json={"fcm_token": ""},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_put_push_token_rejects_too_long_token(client: AsyncClient):
    headers = {"Authorization": "Bearer push-user-long"}
    await client.get("/api/v1/users/me/settings", headers=headers)

    response = await client.put(
        "/api/v1/users/me/push-token",
        headers=headers,
        json={"fcm_token": "x" * 513},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_put_push_token_forbids_extra_fields(client: AsyncClient):
    headers = {"Authorization": "Bearer push-user-extra"}
    await client.get("/api/v1/users/me/settings", headers=headers)

    response = await client.put(
        "/api/v1/users/me/push-token",
        headers=headers,
        json={"fcm_token": "ok", "extra": 1},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_put_push_token_requires_fcm_token_field(client: AsyncClient):
    headers = {"Authorization": "Bearer push-user-missing"}
    await client.get("/api/v1/users/me/settings", headers=headers)

    response = await client.put(
        "/api/v1/users/me/push-token",
        headers=headers,
        json={},
    )
    assert response.status_code == 422

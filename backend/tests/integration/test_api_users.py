"""`/api/v1/users/me/profile` の API integration test。

FakeAuthVerifier + FakeUserRepository 経由で、実 DB / Firebase 無しで経路を検証する。
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_profile_requires_authorization_header(client: AsyncClient):
    response = await client.get("/api/v1/users/me/profile")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_profile_rejects_invalid_token(client: AsyncClient):
    response = await client.get(
        "/api/v1/users/me/profile",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_profile_auto_creates_user_and_returns_defaults(client: AsyncClient):
    response = await client.get(
        "/api/v1/users/me/profile",
        headers={"Authorization": "Bearer user-001"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["firebase_uid"] == "user-001"
    assert body["auth_provider"] == "google"
    assert body["age_group"] is None
    assert body["onboarding_completed"] is False


@pytest.mark.asyncio
async def test_patch_profile_persists_age_group_and_flags_onboarded(client: AsyncClient):
    headers = {"Authorization": "Bearer user-002:apple.com"}

    # 初回 GET で自動作成
    await client.get("/api/v1/users/me/profile", headers=headers)

    patch_response = await client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"display_name": "太郎", "age_group": "20s"},
    )
    assert patch_response.status_code == 200
    patched = patch_response.json()
    assert patched["age_group"] == "20s"
    assert patched["display_name"] == "太郎"
    assert patched["onboarding_completed"] is True
    assert patched["auth_provider"] == "apple"

    # 再取得しても反映されている
    get_response = await client.get("/api/v1/users/me/profile", headers=headers)
    refreshed = get_response.json()
    assert refreshed["age_group"] == "20s"
    assert refreshed["onboarding_completed"] is True


@pytest.mark.asyncio
async def test_patch_profile_rejects_unknown_age_group(client: AsyncClient):
    headers = {"Authorization": "Bearer user-003"}
    await client.get("/api/v1/users/me/profile", headers=headers)

    response = await client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"age_group": "90s"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_profile_forbids_extra_fields(client: AsyncClient):
    headers = {"Authorization": "Bearer user-004"}
    await client.get("/api/v1/users/me/profile", headers=headers)

    response = await client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"unknown_field": "x"},
    )
    assert response.status_code == 422

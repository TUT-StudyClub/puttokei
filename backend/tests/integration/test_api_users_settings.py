"""`/api/v1/users/me/settings` と `/api/v1/users/me` の API integration test。

FakeAuthVerifier + FakeUserRepository 経由で、実 DB / Firebase 無しで経路を検証する。
"""

import pytest
from httpx import AsyncClient

from tests.fakes.fake_user_repository import FakeUserRepository


@pytest.mark.asyncio
async def test_get_settings_requires_authorization_header(client: AsyncClient):
    response = await client.get("/api/v1/users/me/settings")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_settings_auto_creates_user_and_returns_defaults(client: AsyncClient):
    response = await client.get(
        "/api/v1/users/me/settings",
        headers={"Authorization": "Bearer settings-user-001"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["input_minutes"] == 20
    assert body["output_minutes"] == 5
    assert body["break_minutes"] == 5
    assert body["notification_enabled"] is True
    assert "updated_at" in body


@pytest.mark.asyncio
async def test_patch_settings_persists_partial_update(client: AsyncClient):
    headers = {"Authorization": "Bearer settings-user-002"}
    # 初回 GET で AuthenticateUser が user_settings を自動作成
    await client.get("/api/v1/users/me/settings", headers=headers)

    patch_response = await client.patch(
        "/api/v1/users/me/settings",
        headers=headers,
        json={"input_minutes": 30, "notification_enabled": False},
    )
    assert patch_response.status_code == 200
    patched = patch_response.json()
    assert patched["input_minutes"] == 30
    assert patched["notification_enabled"] is False
    # 指定しなかったフィールドはデフォルトを保持
    assert patched["output_minutes"] == 5
    assert patched["break_minutes"] == 5

    # 再取得しても反映されている
    get_response = await client.get("/api/v1/users/me/settings", headers=headers)
    refreshed = get_response.json()
    assert refreshed["input_minutes"] == 30
    assert refreshed["notification_enabled"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"input_minutes": 0}, "input_minutes"),
        ({"input_minutes": 121}, "input_minutes"),
        ({"output_minutes": -1}, "output_minutes"),
        ({"break_minutes": 999}, "break_minutes"),
    ],
)
async def test_patch_settings_rejects_out_of_range_minutes(
    client: AsyncClient, payload: dict, field: str
):
    headers = {"Authorization": f"Bearer settings-range-{field}"}
    await client.get("/api/v1/users/me/settings", headers=headers)

    response = await client.patch("/api/v1/users/me/settings", headers=headers, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"input_minutes": "20"},
        {"output_minutes": 5.5},
        {"break_minutes": True},
        {"notification_enabled": "false"},
        {"notification_enabled": 0},
    ],
)
async def test_patch_settings_rejects_invalid_types(client: AsyncClient, payload: dict):
    headers = {"Authorization": "Bearer settings-user-string"}
    await client.get("/api/v1/users/me/settings", headers=headers)

    response = await client.patch(
        "/api/v1/users/me/settings",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_settings_forbids_extra_fields(client: AsyncClient):
    headers = {"Authorization": "Bearer settings-user-extra"}
    await client.get("/api/v1/users/me/settings", headers=headers)

    response = await client.patch(
        "/api/v1/users/me/settings",
        headers=headers,
        json={"unknown_field": 1},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_settings_rejects_empty_body(client: AsyncClient):
    headers = {"Authorization": "Bearer settings-user-empty"}
    await client.get("/api/v1/users/me/settings", headers=headers)

    response = await client.patch("/api/v1/users/me/settings", headers=headers, json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_settings_requires_authorization_header(client: AsyncClient):
    response = await client.patch("/api/v1/users/me/settings", json={"input_minutes": 30})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_account_requires_authorization_header(client: AsyncClient):
    response = await client.delete("/api/v1/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_account_soft_deletes_user_and_returns_204(
    client: AsyncClient, fake_user_repository: FakeUserRepository
):
    headers = {"Authorization": "Bearer settings-user-delete"}
    # 初回 GET で users + user_settings を AuthenticateUser に作らせる
    get_response = await client.get("/api/v1/users/me/settings", headers=headers)
    assert get_response.status_code == 200
    assert "settings-user-delete" in fake_user_repository.users

    delete_response = await client.delete("/api/v1/users/me", headers=headers)
    assert delete_response.status_code == 204
    assert delete_response.text == ""

    # 論理削除: 行は残り、deleted_at がセットされ、fcm_token がクリアされる
    soft_deleted = fake_user_repository.users["settings-user-delete"]
    assert soft_deleted.deleted_at is not None
    assert soft_deleted.fcm_token is None
    # user_settings は保持される（30 日後バッチで物理削除される時点で CASCADE）
    assert soft_deleted.id in fake_user_repository.settings


@pytest.mark.asyncio
async def test_protected_api_returns_401_after_account_deleted(
    client: AsyncClient,
):
    """論理削除後に同じトークンで保護 API を叩くと 401 になる（再利用防止）。"""
    headers = {"Authorization": "Bearer settings-user-afterdel"}
    assert (await client.get("/api/v1/users/me/settings", headers=headers)).status_code == 200
    assert (await client.delete("/api/v1/users/me", headers=headers)).status_code == 204

    retry = await client.get("/api/v1/users/me/settings", headers=headers)
    assert retry.status_code == 401
    body = retry.json()
    assert body["type"] == "authentication_required"


@pytest.mark.asyncio
async def test_delete_account_second_call_returns_401_for_already_deleted_user(
    client: AsyncClient,
):
    """2 度目の DELETE は認証 use case 段階で 401 になる。"""
    headers = {"Authorization": "Bearer settings-user-twicedel"}
    await client.get("/api/v1/users/me/settings", headers=headers)
    first = await client.delete("/api/v1/users/me", headers=headers)
    assert first.status_code == 204

    second = await client.delete("/api/v1/users/me", headers=headers)
    assert second.status_code == 401

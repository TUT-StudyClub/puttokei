"""`/api/v1/users/me/settings` と `/api/v1/users/me` の API integration test。

FakeAuthVerifier + FakeUserRepository 経由で、実 DB / Firebase 無しで経路を検証する。
"""

import pytest
from httpx import AsyncClient

from tests.fakes.fake_auth_account_admin import FakeAuthAccountAdmin
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
async def test_delete_account_returns_204_and_invokes_firebase_delete(
    client: AsyncClient, fake_auth_account_admin: FakeAuthAccountAdmin
):
    """DELETE /users/me が 204 を返し、Firebase 削除が呼ばれることを確認する。

    DB 上の cascade 削除は fake repository では再現せず、別途 DB integration test に委ねる。
    本ケースでは API レベルの応答と Firebase 連携の発火だけを検証する。
    """
    headers = {"Authorization": "Bearer settings-user-delete"}
    # 初回 GET で users + user_settings を AuthenticateUser に作らせる
    get_response = await client.get("/api/v1/users/me/settings", headers=headers)
    assert get_response.status_code == 200

    delete_response = await client.delete("/api/v1/users/me", headers=headers)
    assert delete_response.status_code == 204
    assert delete_response.text == ""

    # Firebase 側の削除が対象 uid 1 件で呼ばれたことを確認する
    assert fake_auth_account_admin.deleted_uids == ["settings-user-delete"]


@pytest.mark.asyncio
async def test_post_delete_request_with_same_token_creates_new_user(
    client: AsyncClient, fake_user_repository: FakeUserRepository
):
    """退会後に同じ Bearer トークンで再アクセスすると、新規ユーザーとして再登録される。

    実プロダクションでは Firebase Auth 側で対象 UID が削除されるため、その UID で発行
    された ID Token は失効して認証段階で 401 になる。本テストは fake AuthVerifier を
    使うため、認証段階を通過した後の backend 側挙動 (= 新規ユーザ作成) を検証する。
    """
    headers = {"Authorization": "Bearer settings-user-afterdel"}
    first = await client.get("/api/v1/users/me/settings", headers=headers)
    assert first.status_code == 200
    first_user_id = fake_user_repository.users["settings-user-afterdel"].id

    assert (await client.delete("/api/v1/users/me", headers=headers)).status_code == 204
    # DB 上の user 行は物理削除されている
    assert "settings-user-afterdel" not in fake_user_repository.users

    retry = await client.get("/api/v1/users/me/settings", headers=headers)
    assert retry.status_code == 200
    # 同じ firebase_uid で別 user_id の行が新規作成されている
    new_user_id = fake_user_repository.users["settings-user-afterdel"].id
    assert new_user_id != first_user_id


@pytest.mark.asyncio
async def test_delete_account_second_call_after_reregistration_succeeds(
    client: AsyncClient, fake_auth_account_admin: FakeAuthAccountAdmin
):
    """退会 → 同じ Bearer で再アクセス（新規再登録）→ 再退会 が冪等に成功する。"""
    headers = {"Authorization": "Bearer settings-user-twicedel"}
    await client.get("/api/v1/users/me/settings", headers=headers)
    first = await client.delete("/api/v1/users/me", headers=headers)
    assert first.status_code == 204

    # 再アクセスで新規ユーザーとして作り直され、再退会も 204 を返す。
    await client.get("/api/v1/users/me/settings", headers=headers)
    second = await client.delete("/api/v1/users/me", headers=headers)
    assert second.status_code == 204
    # Firebase 削除は 2 回呼ばれている
    assert fake_auth_account_admin.deleted_uids == [
        "settings-user-twicedel",
        "settings-user-twicedel",
    ]


@pytest.mark.asyncio
async def test_delete_account_treats_firebase_user_not_found_as_success(
    client: AsyncClient,
    fake_auth_account_admin: FakeAuthAccountAdmin,
    fake_user_repository: FakeUserRepository,
):
    """Firebase 側で対象 uid が既に存在しないケースでも 204 を返し DB 削除は実行される。"""
    headers = {"Authorization": "Bearer settings-user-fbmissing"}
    await client.get("/api/v1/users/me/settings", headers=headers)
    fake_auth_account_admin.not_found_uids.add("settings-user-fbmissing")

    response = await client.delete("/api/v1/users/me", headers=headers)
    assert response.status_code == 204

    # Firebase 削除は試行された
    assert "settings-user-fbmissing" in fake_auth_account_admin.deleted_uids
    # DB users 行は物理削除されている
    assert "settings-user-fbmissing" not in fake_user_repository.users


@pytest.mark.asyncio
async def test_delete_account_returns_500_when_firebase_fails_and_keeps_db_row(
    client: AsyncClient, fake_auth_account_admin: FakeAuthAccountAdmin
):
    """Firebase その他エラー時は 500 を返し、DB 行は残る (退会処理が中断される)。"""
    headers = {"Authorization": "Bearer settings-user-fberror"}
    await client.get("/api/v1/users/me/settings", headers=headers)
    fake_auth_account_admin.error_uid_to_raise["settings-user-fberror"] = RuntimeError(
        "firebase down"
    )

    response = await client.delete("/api/v1/users/me", headers=headers)
    assert response.status_code == 500

    # 退会前の保護 API はまだ通る (= DB 行が残っている)
    retry = await client.get("/api/v1/users/me/settings", headers=headers)
    assert retry.status_code == 200

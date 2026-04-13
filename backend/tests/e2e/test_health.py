"""ヘルスチェックの E2E テスト。

`/health` は常に ok を返し、`/health/ready` はテスト環境の DB に到達できないため
`status=degraded`, `db=ng` を返すことを確認する。
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_ready_returns_degraded_without_db(client: AsyncClient) -> None:
    """テスト用 Settings の DB は到達不可なので degraded を期待する。"""
    response = await client.get("/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body == {"status": "degraded", "db": "ng"}

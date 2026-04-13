"""共通 pytest fixture。

- `settings` ... テスト用に DB URL などを上書きした Settings
- `app`      ... 上記 settings から組み立てた FastAPI アプリ
- `client`   ... httpx の AsyncClient（lifespan を実行する）
"""

from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.config import Settings
from src.main import create_app


@pytest_asyncio.fixture
async def settings() -> Settings:
    """テスト用 Settings。SQLite 互換の dummy URL を使い、DB 疎通テストでは degraded を期待する。"""
    return Settings(
        app_env="test",
        database_url="postgresql+asyncpg://test:test@127.0.0.1:1/hourglass_test",
        firebase_project_id="hourglass-test",
        log_level="WARNING",
    )


@pytest_asyncio.fixture
async def client(settings: Settings) -> AsyncIterator[AsyncClient]:
    """ASGITransport で lifespan を実行しながら HTTP 呼び出しできる AsyncClient。"""
    app = create_app(settings)
    transport = ASGITransport(app=app)
    async with (
        AsyncClient(transport=transport, base_url="http://testserver") as ac,
        app.router.lifespan_context(app),
    ):
        yield ac

"""FastAPI エントリポイント。

Composition Root でコンテナを組み立て、ルーターを束ねる。
詳細なエンドポイント実装は後続 Epic で追加する。
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.config import Settings, get_settings
from src.container import Container, build_container
from src.presentation.api.v1.router import api_v1_router
from src.presentation.health import health_router


def create_app(
    settings: Settings | None = None,
    container: Container | None = None,
) -> FastAPI:
    """FastAPI アプリを生成する。テストでは `container` を差し替えて fake 実装を注入する。"""
    resolved_settings = settings or get_settings()
    resolved_container: Container = container or build_container(resolved_settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.container = resolved_container
        try:
            yield
        finally:
            await resolved_container.database.dispose()

    app = FastAPI(
        title="Hourglass API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.include_router(health_router)
    app.include_router(api_v1_router, prefix="/api/v1")

    return app


app = create_app()


def get_container(app: FastAPI) -> Container:
    """app.state.container を型付きで取得するヘルパ。"""
    return app.state.container  # type: ignore[no-any-return]

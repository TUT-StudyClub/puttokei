"""FastAPI エントリポイント。

Composition Root でコンテナを組み立て、ルーターを束ねる。
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError

from src.config import Settings, get_settings
from src.container import Container, build_container
from src.presentation.api.v1.router import api_v1_router
from src.presentation.health import health_router
from src.presentation.problem_details import (
    ProblemDetailsError,
    http_exception_handler,
    problem_details_exception_handler,
    unexpected_exception_handler,
    validation_exception_handler,
)


def create_app(
    settings: Settings | None = None,
    container: Container | None = None,
) -> FastAPI:
    """FastAPI アプリを生成する。テストでは `container` を差し替えて fake 実装を注入する。"""
    resolved_settings = settings or get_settings()
    # アプリ独自 logger（src.* 配下）の INFO ログが uvicorn 経由で表示されるように、
    # root logger のレベルを Settings に合わせて引き下げる。force=False で uvicorn の
    # 既存 handler 設定は維持する。
    logging.basicConfig(level=resolved_settings.log_level)
    logging.getLogger("src").setLevel(resolved_settings.log_level)
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
    app.add_exception_handler(ProblemDetailsError, problem_details_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unexpected_exception_handler)

    app.include_router(health_router)
    app.include_router(api_v1_router, prefix="/api/v1")

    return app


app = create_app()


def get_container(app: FastAPI) -> Container:
    """app.state.container を型付きで取得するヘルパ。"""
    return app.state.container  # type: ignore[no-any-return]

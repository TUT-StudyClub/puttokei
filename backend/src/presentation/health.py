"""ヘルスチェックエンドポイント。

- `/health`     ... 死活確認のみ
- `/health/ready` ... DB 接続を含む準備完了確認
"""

from typing import Literal

from fastapi import APIRouter, Request

from src.common.models import FrozenModel
from src.presentation.container_access import get_presentation_container

health_router = APIRouter(tags=["health"])


class HealthResponse(FrozenModel):
    """`/health` のレスポンス。"""

    status: Literal["ok"]


class ReadinessResponse(FrozenModel):
    """`/health/ready` のレスポンス。"""

    status: Literal["ok", "degraded"]
    db: Literal["ok", "ng"]


@health_router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """サーバーが起動していることのみを示す。"""
    return HealthResponse(status="ok")


@health_router.get("/health/ready", response_model=ReadinessResponse)
async def ready(request: Request) -> ReadinessResponse:
    """DB を含む準備完了確認。DB に到達できなければ degraded を返す。"""
    container = get_presentation_container(request)
    db_ok = await container.database.ping()
    return ReadinessResponse(
        status="ok" if db_ok else "degraded",
        db="ok" if db_ok else "ng",
    )

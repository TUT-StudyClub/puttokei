"""v1 ルーターの統合。

各機能ルーターは Task 完了のタイミングで `include_router` する。
"""

from fastapi import APIRouter

from src.presentation.api.v1.sessions import sessions_router
from src.presentation.api.v1.users import users_router

api_v1_router = APIRouter()
api_v1_router.include_router(users_router)
api_v1_router.include_router(sessions_router)

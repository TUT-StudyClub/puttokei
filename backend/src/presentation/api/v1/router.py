"""v1 ルーターの統合。

各機能ルーターは後続 Epic で `include_router` する。
"""

from fastapi import APIRouter

api_v1_router = APIRouter()

"""非同期 SQLAlchemy のエンジンとセッションファクトリ。

Composition Root から `Database` を組み立て、リポジトリ実装に session を渡す。
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


class Database:
    """非同期エンジンとセッションファクトリの薄いラッパー。"""

    def __init__(self, database_url: str) -> None:
        self._engine: AsyncEngine = create_async_engine(database_url, future=True)
        self._session_factory = async_sessionmaker(
            self._engine, expire_on_commit=False, class_=AsyncSession
        )

    @property
    def engine(self) -> AsyncEngine:
        return self._engine

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """1 リクエストにつき 1 セッション。コミットは利用側で行う。"""
        async with self._session_factory() as session:
            yield session

    async def ping(self) -> bool:
        """DB に対して `SELECT 1` を投げ、接続を確認する。失敗時は False。"""
        try:
            async with self._engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

    async def dispose(self) -> None:
        """エンジンの全コネクションを解放する。アプリ終了時に呼ぶ。"""
        await self._engine.dispose()

"""SQLAlchemy を使った Unit of Work 実装。"""

from __future__ import annotations

from contextlib import AbstractAsyncContextManager
from types import TracebackType
from typing import Self

from sqlalchemy.ext.asyncio import AsyncSession

from src.application.unit_of_work import ApplicationUnitOfWork
from src.infrastructure.persistence.database import Database
from src.infrastructure.persistence.repositories.pg_judgment_progress_repository import (
    PgJudgmentProgressRepository,
)
from src.infrastructure.persistence.repositories.pg_judgment_repository import (
    PgJudgmentRepository,
)
from src.infrastructure.persistence.repositories.pg_output_repository import PgOutputRepository
from src.infrastructure.persistence.repositories.pg_session_repository import (
    PgSessionRepository,
)
from src.infrastructure.persistence.repositories.pg_stats_repository import PgStatsRepository
from src.infrastructure.persistence.repositories.pg_study_subject_repository import (
    PgStudySubjectRepository,
)
from src.infrastructure.persistence.repositories.pg_user_repository import PgUserRepository


class SqlAlchemyUnitOfWork(ApplicationUnitOfWork):
    """1 use case 実行分の DB トランザクションを管理する。"""

    def __init__(self, database: Database) -> None:
        self._database = database
        self._session_context: AbstractAsyncContextManager[AsyncSession] | None = None
        self._session: AsyncSession | None = None
        self._committed = False
        self.users: PgUserRepository
        self.sessions: PgSessionRepository
        self.outputs: PgOutputRepository
        self.study_subjects: PgStudySubjectRepository
        self.judgments: PgJudgmentRepository
        self.judgment_progresses: PgJudgmentProgressRepository
        self.stats: PgStatsRepository

    async def __aenter__(self) -> Self:
        self._session_context = self._database.session()
        self._session = await self._session_context.__aenter__()
        self._committed = False
        self.users = PgUserRepository(self._session)
        self.sessions = PgSessionRepository(self._session)
        self.outputs = PgOutputRepository(self._session)
        self.study_subjects = PgStudySubjectRepository(self._session)
        self.judgments = PgJudgmentRepository(self._session)
        self.judgment_progresses = PgJudgmentProgressRepository(self._session)
        self.stats = PgStatsRepository(self._session)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        try:
            if not self._committed:
                await self.rollback()
        finally:
            if self._session_context is not None:
                await self._session_context.__aexit__(exc_type, exc, traceback)
            self._session_context = None
            self._session = None

    async def commit(self) -> None:
        session = self._require_session()
        await session.commit()
        self._committed = True

    async def rollback(self) -> None:
        session = self._require_session()
        await session.rollback()

    def _require_session(self) -> AsyncSession:
        if self._session is None:
            raise RuntimeError("Unit of Work has not been entered.")
        return self._session

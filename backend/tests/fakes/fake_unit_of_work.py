"""テスト用 Unit of Work 実装。"""

from __future__ import annotations

from types import TracebackType
from typing import Self

from src.application.unit_of_work import ApplicationUnitOfWork
from tests.fakes.fake_judgment_progress_repository import FakeJudgmentProgressRepository
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository
from tests.fakes.fake_output_repository import FakeOutputRepository
from tests.fakes.fake_session_repository import FakeSessionRepository
from tests.fakes.fake_user_repository import FakeUserRepository


class FakeUnitOfWork(ApplicationUnitOfWork):
    """in-memory repository を束ねる Unit of Work。"""

    def __init__(
        self,
        *,
        users: FakeUserRepository | None = None,
        sessions: FakeSessionRepository | None = None,
        outputs: FakeOutputRepository | None = None,
        judgments: FakeJudgmentRepository | None = None,
        judgment_progresses: FakeJudgmentProgressRepository | None = None,
    ) -> None:
        self.users = users or FakeUserRepository()
        self.sessions = sessions or FakeSessionRepository()
        self.outputs = outputs or FakeOutputRepository()
        self.judgments = judgments or FakeJudgmentRepository()
        self.judgment_progresses = judgment_progresses or FakeJudgmentProgressRepository()
        self.commit_count = 0
        self.rollback_count = 0
        self.enter_count = 0
        self._committed = False

    async def __aenter__(self) -> Self:
        self.enter_count += 1
        self._committed = False
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        del exc, traceback
        if exc_type is not None or not self._committed:
            await self.rollback()

    async def commit(self) -> None:
        self.commit_count += 1
        self._committed = True

    async def rollback(self) -> None:
        self.rollback_count += 1

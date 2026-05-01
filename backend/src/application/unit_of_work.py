"""Application 層が使う Unit of Work の抽象 IF。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from types import TracebackType
from typing import Self

from src.domain.repositories.judgment_progress_repository import (
    JudgmentProgressRepository,
)
from src.domain.repositories.judgment_repository import JudgmentRepository
from src.domain.repositories.output_repository import OutputRepository
from src.domain.repositories.session_repository import SessionRepository
from src.domain.repositories.user_repository import UserRepository


class ApplicationUnitOfWork(ABC):
    """use case 単位のトランザクション境界を表す抽象 IF。"""

    users: UserRepository
    sessions: SessionRepository
    outputs: OutputRepository
    judgments: JudgmentRepository
    judgment_progresses: JudgmentProgressRepository

    @abstractmethod
    async def __aenter__(self) -> Self:
        """トランザクションを開始し、repository を利用可能にする。"""

    @abstractmethod
    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        """未 commit または例外発生時は rollback して閉じる。"""

    @abstractmethod
    async def commit(self) -> None:
        """現在のトランザクションを確定する。"""

    @abstractmethod
    async def rollback(self) -> None:
        """現在のトランザクションを破棄する。"""


type UnitOfWorkFactory = Callable[[], ApplicationUnitOfWork]

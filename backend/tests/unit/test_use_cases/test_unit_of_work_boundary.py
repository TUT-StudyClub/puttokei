"""write use case の Unit of Work 境界。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.dto.session_dto import CreateSessionCommand, UpdateSessionStatusCommand
from src.application.use_cases.create_session import CreateSession
from src.application.use_cases.update_session_status import (
    InvalidSessionStatusTransitionError,
    UpdateSessionStatus,
)
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.value_objects.auth_provider import AuthProvider
from src.domain.value_objects.session_status import SessionStatus
from tests.fakes.fake_session_repository import FakeSessionRepository
from tests.fakes.fake_unit_of_work import FakeUnitOfWork


def _make_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid="uid-001",
        auth_provider=AuthProvider.GOOGLE,
        created_at=now,
        updated_at=now,
    )


def _make_session(user: User, status: SessionStatus) -> Session:
    now = datetime.now(UTC)
    return Session(
        id=uuid4(),
        user_id=user.id,
        status=status,
        subject="英語",
        topic="関係代名詞",
        input_minutes=20,
        output_minutes=5,
        break_minutes=5,
        started_at=now,
        completed_at=None,
        created_at=now,
    )


@pytest.mark.asyncio
async def test_write_use_case_commits_on_success():
    repo = FakeSessionRepository()
    uow = FakeUnitOfWork(sessions=repo)
    use_case = CreateSession(unit_of_work_factory=lambda: uow)

    await use_case.execute(
        _make_user(),
        CreateSessionCommand(
            subject="英語",
            topic="関係代名詞",
            input_minutes=20,
            output_minutes=5,
            break_minutes=5,
        ),
    )

    assert uow.commit_count == 1
    assert uow.rollback_count == 0


@pytest.mark.asyncio
async def test_write_use_case_rolls_back_on_exception():
    user = _make_user()
    repo = FakeSessionRepository()
    session = _make_session(user, SessionStatus.INPUT)
    await repo.add(session)
    uow = FakeUnitOfWork(sessions=repo)
    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: uow)

    with pytest.raises(InvalidSessionStatusTransitionError):
        await use_case.execute(
            user,
            UpdateSessionStatusCommand(
                session_id=session.id,
                new_status=SessionStatus.JUDGED,
            ),
        )

    assert uow.commit_count == 0
    assert uow.rollback_count == 1

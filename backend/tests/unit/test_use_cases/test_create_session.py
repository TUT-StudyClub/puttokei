"""CreateSession UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.dto.session_dto import CreateSessionCommand
from src.application.use_cases.create_session import CreateSession
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
        display_name=None,
        age_group=None,
        onboarding_completed=True,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_create_session_persists_input_status_session():
    repo = FakeSessionRepository()
    user = _make_user()
    use_case = CreateSession(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))

    view = await use_case.execute(
        user,
        CreateSessionCommand(
            subject="英語",
            topic="関係代名詞",
            input_minutes=20,
            output_minutes=5,
            break_minutes=5,
        ),
    )

    assert view.user_id == user.id
    assert view.status is SessionStatus.INPUT
    assert view.subject == "英語"
    assert view.topic == "関係代名詞"
    assert view.input_minutes == 20
    assert view.output_minutes == 5
    assert view.break_minutes == 5
    assert view.completed_at is None
    assert view.started_at == view.created_at
    # リポジトリにも保存されている
    saved = repo.sessions[view.id]
    assert saved.user_id == user.id
    assert saved.status is SessionStatus.INPUT


@pytest.mark.asyncio
async def test_create_session_uses_custom_timer_values():
    repo = FakeSessionRepository()
    use_case = CreateSession(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))

    view = await use_case.execute(
        _make_user(),
        CreateSessionCommand(
            subject="数学",
            topic="極限",
            input_minutes=30,
            output_minutes=10,
            break_minutes=3,
        ),
    )

    assert view.input_minutes == 30
    assert view.output_minutes == 10
    assert view.break_minutes == 3

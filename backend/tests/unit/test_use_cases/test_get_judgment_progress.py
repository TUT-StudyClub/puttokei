"""GetJudgmentProgress UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.use_cases.get_judgment_progress import (
    GetJudgmentProgress,
    SessionNotFoundError,
)
from src.domain.entities.judgment_progress import JudgmentProgress
from src.domain.entities.output import Output
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.value_objects.auth_provider import AuthProvider
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.domain.value_objects.output_kind import OutputKind
from src.domain.value_objects.session_status import SessionStatus
from tests.fakes.fake_judgment_progress_repository import FakeJudgmentProgressRepository
from tests.fakes.fake_output_repository import FakeOutputRepository
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


def _make_session(user: User, status: SessionStatus = SessionStatus.JUDGING) -> Session:
    now = datetime.now(UTC)
    return Session(
        id=uuid4(),
        user_id=user.id,
        status=status,
        subject="歴史",
        topic="本能寺の変",
        input_minutes=20,
        output_minutes=5,
        break_minutes=5,
        started_at=now,
        completed_at=None,
        created_at=now,
    )


@pytest.mark.asyncio
async def test_get_judgment_progress_returns_saved_progress():
    user = _make_user()
    session = _make_session(user)
    now = datetime.now(UTC)
    sessions = FakeSessionRepository()
    progresses = FakeJudgmentProgressRepository()
    await sessions.add(session)
    await progresses.upsert(
        JudgmentProgress(
            session_id=session.id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.RECEIVING_LLM,
            percent=65,
            message="AI から判定内容を受信しています。",
            event_seq=4,
            started_at=now,
            updated_at=now,
            completed_at=None,
            error_code=None,
        )
    )
    use_case = GetJudgmentProgress(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            judgment_progresses=progresses,
        ),
    )

    view = await use_case.execute(user, session.id)

    assert view.status is JudgmentProgressStatus.RUNNING
    assert view.stage is JudgmentProgressStage.RECEIVING_LLM
    assert view.percent == 65
    assert view.event_seq == 4


@pytest.mark.asyncio
async def test_get_judgment_progress_returns_synthetic_queued_for_legacy_pending_session():
    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    await sessions.add(session)
    await outputs.upsert(
        Output(
            id=uuid4(),
            session_id=session.id,
            kind=OutputKind.TEXT,
            content="明智光秀が織田信長を本能寺で討った出来事について説明しました。",
            image_storage_path=None,
            submitted_at=datetime.now(UTC),
        )
    )
    use_case = GetJudgmentProgress(
        unit_of_work_factory=lambda: FakeUnitOfWork(sessions=sessions, outputs=outputs),
    )

    view = await use_case.execute(user, session.id)

    assert view.status is JudgmentProgressStatus.QUEUED
    assert view.stage is JudgmentProgressStage.QUEUED
    assert view.percent == 5


@pytest.mark.asyncio
async def test_get_judgment_progress_rejects_other_users_session():
    owner = _make_user()
    other = _make_user()
    session = _make_session(owner)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    use_case = GetJudgmentProgress(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=sessions))

    with pytest.raises(SessionNotFoundError):
        await use_case.execute(other, session.id)

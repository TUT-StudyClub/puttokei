"""SubmitImageOutput UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.dto.session_dto import SubmitImageOutputCommand
from src.application.use_cases.submit_image_output import SubmitImageOutput
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
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository
from tests.fakes.fake_output_repository import FakeOutputRepository
from tests.fakes.fake_session_repository import FakeSessionRepository
from tests.fakes.fake_unit_of_work import FakeUnitOfWork


def _make_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid="uid-img-001",
        auth_provider=AuthProvider.GOOGLE,
        display_name=None,
        age_group=None,
        onboarding_completed=True,
        created_at=now,
        updated_at=now,
    )


def _make_session(user: User) -> Session:
    now = datetime.now(UTC)
    return Session(
        id=uuid4(),
        user_id=user.id,
        status=SessionStatus.OUTPUT,
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
async def test_submit_image_output_saves_image_path_and_advances_session():
    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    judgments = FakeJudgmentRepository()
    judgment_progresses = FakeJudgmentProgressRepository()
    await sessions.add(session)
    use_case = SubmitImageOutput(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            outputs=outputs,
            judgments=judgments,
            judgment_progresses=judgment_progresses,
        ),
    )

    view = await use_case.execute(
        user,
        SubmitImageOutputCommand(
            session_id=session.id,
            image_storage_path=f"outputs/{user.id}/abc.jpg",
            submitted_at=datetime.now(UTC),
        ),
    )

    saved_session = await sessions.find_by_id(session.id)
    saved_output = await outputs.find_by_session_id(session.id)
    saved_progress = await judgment_progresses.find_by_session_id(session.id)
    assert view.status is SessionStatus.JUDGING
    assert saved_session is not None
    assert saved_session.status is SessionStatus.JUDGING
    assert saved_output is not None
    assert saved_output.kind is OutputKind.IMAGE
    assert saved_output.content is None
    assert saved_output.image_storage_path == f"outputs/{user.id}/abc.jpg"
    assert saved_progress is not None
    assert saved_progress.status is JudgmentProgressStatus.QUEUED
    assert saved_progress.stage is JudgmentProgressStage.QUEUED

"""SubmitOutput UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.dto.session_dto import SubmitOutputCommand
from src.application.use_cases.submit_output import SubmitOutput
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.value_objects.auth_provider import AuthProvider
from src.domain.value_objects.session_status import SessionStatus
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository
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
async def test_submit_output_advances_session_to_judging():
    """output 保存後 session は JUDGING に遷移し、判定はこの use case 内では走らない。"""
    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    judgments = FakeJudgmentRepository()
    await sessions.add(session)
    use_case = SubmitOutput(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            outputs=outputs,
            judgments=judgments,
        ),
    )

    view = await use_case.execute(
        user,
        SubmitOutputCommand(
            session_id=session.id,
            content="明智光秀が織田信長を本能寺で討った出来事について説明しました。",
            submitted_at=datetime.now(UTC),
        ),
    )

    saved_session = await sessions.find_by_id(session.id)
    saved_judgment = await judgments.find_by_session_id(session.id)
    assert view.status is SessionStatus.JUDGING
    assert saved_session is not None
    assert saved_session.status is SessionStatus.JUDGING
    # 判定は別 use case (RunLocalJudgment) の責務になったため、ここでは保存されない
    assert saved_judgment is None

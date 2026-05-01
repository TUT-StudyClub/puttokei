"""IssueOutputImageUploadUrl UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.dto.session_dto import IssueOutputImageUploadUrlCommand
from src.application.use_cases.issue_output_image_upload_url import (
    IssueOutputImageUploadUrl,
    UnsupportedMimeTypeError,
)
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.value_objects.auth_provider import AuthProvider
from src.domain.value_objects.session_status import SessionStatus
from tests.fakes.fake_judgment_progress_repository import FakeJudgmentProgressRepository
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository
from tests.fakes.fake_output_image_storage import FakeOutputImageStorage
from tests.fakes.fake_output_repository import FakeOutputRepository
from tests.fakes.fake_session_repository import FakeSessionRepository
from tests.fakes.fake_unit_of_work import FakeUnitOfWork


def _make_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid="uid-up-001",
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


def _make_use_case(sessions: FakeSessionRepository, storage: FakeOutputImageStorage):
    return IssueOutputImageUploadUrl(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            outputs=FakeOutputRepository(),
            judgments=FakeJudgmentRepository(),
            judgment_progresses=FakeJudgmentProgressRepository(),
        ),
        storage=storage,
        allowed_mime_types=("image/jpeg", "image/png"),
        upload_url_ttl_seconds=600,
    )


@pytest.mark.asyncio
async def test_issue_upload_url_returns_signed_url_under_user_namespace():
    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    storage = FakeOutputImageStorage()
    use_case = _make_use_case(sessions, storage)

    view = await use_case.execute(
        user,
        IssueOutputImageUploadUrlCommand(session_id=session.id, mime_type="image/jpeg"),
    )

    assert view.storage_path.startswith(f"outputs/{user.id}/")
    assert view.storage_path.endswith(".jpg")
    assert view.upload_url.startswith("https://fake.storage/upload/")
    assert len(storage.upload_calls) == 1
    assert storage.upload_calls[0][1] == "image/jpeg"


@pytest.mark.asyncio
async def test_issue_upload_url_rejects_unsupported_mime_type():
    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    storage = FakeOutputImageStorage()
    use_case = _make_use_case(sessions, storage)

    with pytest.raises(UnsupportedMimeTypeError):
        await use_case.execute(
            user,
            IssueOutputImageUploadUrlCommand(session_id=session.id, mime_type="image/heic"),
        )

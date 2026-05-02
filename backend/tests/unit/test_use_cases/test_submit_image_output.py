"""SubmitImageOutput UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.dto.session_dto import SubmitImageOutputCommand
from src.application.use_cases.submit_image_output import (
    InvalidSessionStatusError,
    InvalidStoragePathError,
    SessionNotFoundError,
    SubmitImageOutput,
)
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
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository
from tests.fakes.fake_output_image_storage import FakeOutputImageStorage
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


def _make_session(user: User, status: SessionStatus = SessionStatus.OUTPUT) -> Session:
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


def _make_use_case(
    sessions: FakeSessionRepository,
    outputs: FakeOutputRepository,
    image_storage: FakeOutputImageStorage | None = None,
) -> SubmitImageOutput:
    return SubmitImageOutput(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            outputs=outputs,
            judgments=FakeJudgmentRepository(),
            judgment_progresses=FakeJudgmentProgressRepository(),
        ),
        image_storage=image_storage,
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


@pytest.mark.asyncio
async def test_submit_image_output_rejects_other_users_path():
    user = _make_user()
    other_user_id = uuid4()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    use_case = _make_use_case(sessions, FakeOutputRepository())

    with pytest.raises(InvalidStoragePathError):
        await use_case.execute(
            user,
            SubmitImageOutputCommand(
                session_id=session.id,
                image_storage_path=f"outputs/{other_user_id}/leaked.jpg",
                submitted_at=datetime.now(UTC),
            ),
        )


@pytest.mark.asyncio
async def test_submit_image_output_rejects_path_traversal():
    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    use_case = _make_use_case(sessions, FakeOutputRepository())

    with pytest.raises(InvalidStoragePathError):
        await use_case.execute(
            user,
            SubmitImageOutputCommand(
                session_id=session.id,
                # prefix を満たしつつ ".." で別 prefix に抜けようとする
                image_storage_path=f"outputs/{user.id}/../{uuid4()}/leaked.jpg",
                submitted_at=datetime.now(UTC),
            ),
        )


@pytest.mark.asyncio
async def test_submit_image_output_returns_session_not_found_for_other_users_session():
    owner = _make_user()
    intruder = _make_user()
    session = _make_session(owner)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    use_case = _make_use_case(sessions, FakeOutputRepository())

    # intruder は自分の id でプレフィックスを満たすが、session は owner のもの。
    with pytest.raises(SessionNotFoundError):
        await use_case.execute(
            intruder,
            SubmitImageOutputCommand(
                session_id=session.id,
                image_storage_path=f"outputs/{intruder.id}/abc.jpg",
                submitted_at=datetime.now(UTC),
            ),
        )


@pytest.mark.parametrize(
    "status",
    # JUDGING は再提出を許す仕様 (can_accept_output() が True を返す) ので除外。
    [SessionStatus.INPUT, SessionStatus.JUDGED, SessionStatus.CANCELLED],
)
@pytest.mark.asyncio
async def test_submit_image_output_rejects_invalid_session_status(status: SessionStatus):
    user = _make_user()
    session = _make_session(user, status=status)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    use_case = _make_use_case(sessions, FakeOutputRepository())

    with pytest.raises(InvalidSessionStatusError):
        await use_case.execute(
            user,
            SubmitImageOutputCommand(
                session_id=session.id,
                image_storage_path=f"outputs/{user.id}/abc.jpg",
                submitted_at=datetime.now(UTC),
            ),
        )


@pytest.mark.asyncio
async def test_submit_image_output_image_to_image_overwrite_deletes_old_object():
    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    storage = FakeOutputImageStorage()
    old_path = f"outputs/{user.id}/old.jpg"
    new_path = f"outputs/{user.id}/new.jpg"
    storage.put(old_path, b"old", "image/jpeg")
    await sessions.add(session)
    await outputs.upsert(
        Output(
            id=uuid4(),
            session_id=session.id,
            kind=OutputKind.IMAGE,
            content=None,
            image_storage_path=old_path,
            submitted_at=datetime.now(UTC),
        )
    )
    use_case = _make_use_case(sessions, outputs, image_storage=storage)

    await use_case.execute(
        user,
        SubmitImageOutputCommand(
            session_id=session.id,
            image_storage_path=new_path,
            submitted_at=datetime.now(UTC),
        ),
    )

    assert storage.delete_calls == [old_path]
    assert old_path not in storage.objects


@pytest.mark.asyncio
async def test_submit_image_output_image_to_image_same_path_does_not_delete():
    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    storage = FakeOutputImageStorage()
    same_path = f"outputs/{user.id}/same.jpg"
    storage.put(same_path, b"same", "image/jpeg")
    await sessions.add(session)
    await outputs.upsert(
        Output(
            id=uuid4(),
            session_id=session.id,
            kind=OutputKind.IMAGE,
            content=None,
            image_storage_path=same_path,
            submitted_at=datetime.now(UTC),
        )
    )
    use_case = _make_use_case(sessions, outputs, image_storage=storage)

    await use_case.execute(
        user,
        SubmitImageOutputCommand(
            session_id=session.id,
            image_storage_path=same_path,
            submitted_at=datetime.now(UTC),
        ),
    )

    assert storage.delete_calls == []
    assert same_path in storage.objects


@pytest.mark.asyncio
async def test_submit_image_output_text_to_image_overwrite_does_not_delete_storage():
    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    storage = FakeOutputImageStorage()
    new_path = f"outputs/{user.id}/from-text.jpg"
    await sessions.add(session)
    # 旧 output が text の場合は image_storage_path が無いので削除対象なし。
    await outputs.upsert(
        Output(
            id=uuid4(),
            session_id=session.id,
            kind=OutputKind.TEXT,
            content="昨日のテキスト",
            image_storage_path=None,
            submitted_at=datetime.now(UTC),
        )
    )
    use_case = _make_use_case(sessions, outputs, image_storage=storage)

    await use_case.execute(
        user,
        SubmitImageOutputCommand(
            session_id=session.id,
            image_storage_path=new_path,
            submitted_at=datetime.now(UTC),
        ),
    )

    assert storage.delete_calls == []
    saved = await outputs.find_by_session_id(session.id)
    assert saved is not None
    assert saved.kind is OutputKind.IMAGE
    assert saved.image_storage_path == new_path


@pytest.mark.asyncio
async def test_submit_image_output_swallows_storage_delete_failure():
    """旧 GCS オブジェクト削除に失敗してもアプリ動作は止まらない。"""

    class _FailingStorage(FakeOutputImageStorage):
        async def delete(self, *, storage_path: str) -> None:
            self.delete_calls.append(storage_path)
            raise RuntimeError("boom")

    user = _make_user()
    session = _make_session(user)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    storage = _FailingStorage()
    old_path = f"outputs/{user.id}/old.jpg"
    new_path = f"outputs/{user.id}/new.jpg"
    await sessions.add(session)
    await outputs.upsert(
        Output(
            id=uuid4(),
            session_id=session.id,
            kind=OutputKind.IMAGE,
            content=None,
            image_storage_path=old_path,
            submitted_at=datetime.now(UTC),
        )
    )
    use_case = _make_use_case(sessions, outputs, image_storage=storage)

    # 削除失敗で例外が leak しないこと（提出自体は成功する）
    view = await use_case.execute(
        user,
        SubmitImageOutputCommand(
            session_id=session.id,
            image_storage_path=new_path,
            submitted_at=datetime.now(UTC),
        ),
    )
    assert view.status is SessionStatus.JUDGING
    assert storage.delete_calls == [old_path]

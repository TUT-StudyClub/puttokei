"""UpdateSessionStatus UseCase の振る舞い。

`_ALLOWED_TRANSITIONS` で許可された遷移のみが通り、
終端 (judged / cancelled) 到達時は completed_at がセットされる。
他ユーザーの session と存在しない session は区別せず 404 相当の例外を投げる。
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from src.application.dto.session_dto import UpdateSessionStatusCommand
from src.application.use_cases.update_session_status import (
    InvalidSessionStatusTransitionError,
    SessionNotFoundError,
    UpdateSessionStatus,
)
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.value_objects.auth_provider import AuthProvider
from src.domain.value_objects.session_status import SessionStatus
from tests.fakes.fake_session_repository import FakeSessionRepository
from tests.fakes.fake_unit_of_work import FakeUnitOfWork


def _make_user(user_id: UUID | None = None) -> User:
    now = datetime.now(UTC)
    return User(
        id=user_id if user_id is not None else uuid4(),
        firebase_uid="uid-owner",
        auth_provider=AuthProvider.GOOGLE,
        display_name=None,
        age_group=None,
        onboarding_completed=False,
        created_at=now,
        updated_at=now,
    )


def _make_session(
    user_id: UUID,
    *,
    session_status: SessionStatus = SessionStatus.INPUT,
) -> Session:
    now = datetime.now(UTC)
    return Session(
        id=uuid4(),
        user_id=user_id,
        status=session_status,
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
async def test_updates_status_from_input_to_output():
    repo = FakeSessionRepository()
    user = _make_user()
    session = _make_session(user.id, session_status=SessionStatus.INPUT)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    view = await use_case.execute(
        user,
        UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.OUTPUT),
    )

    assert view.status is SessionStatus.OUTPUT
    assert repo.sessions[session.id].status is SessionStatus.OUTPUT
    # output 遷移では completed_at はセットされない
    assert view.completed_at is None


@pytest.mark.asyncio
async def test_updates_status_from_output_to_judging():
    repo = FakeSessionRepository()
    user = _make_user()
    session = _make_session(user.id, session_status=SessionStatus.OUTPUT)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    view = await use_case.execute(
        user,
        UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.JUDGING),
    )

    assert view.status is SessionStatus.JUDGING
    assert view.completed_at is None


@pytest.mark.asyncio
async def test_judged_transition_sets_completed_at():
    repo = FakeSessionRepository()
    user = _make_user()
    session = _make_session(user.id, session_status=SessionStatus.JUDGING)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    view = await use_case.execute(
        user,
        UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.JUDGED),
    )

    assert view.status is SessionStatus.JUDGED
    assert view.completed_at is not None


@pytest.mark.asyncio
async def test_cancelled_transition_sets_completed_at():
    repo = FakeSessionRepository()
    user = _make_user()
    session = _make_session(user.id, session_status=SessionStatus.INPUT)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    view = await use_case.execute(
        user,
        UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.CANCELLED),
    )

    assert view.status is SessionStatus.CANCELLED
    assert view.completed_at is not None


@pytest.mark.asyncio
async def test_skip_transition_is_rejected():
    """input から judged に直接飛ぶ遷移は許可しない。"""
    repo = FakeSessionRepository()
    user = _make_user()
    session = _make_session(user.id, session_status=SessionStatus.INPUT)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    with pytest.raises(InvalidSessionStatusTransitionError):
        await use_case.execute(
            user,
            UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.JUDGED),
        )


@pytest.mark.asyncio
async def test_backward_transition_is_rejected():
    """output から input への戻り遷移は許可しない。"""
    repo = FakeSessionRepository()
    user = _make_user()
    session = _make_session(user.id, session_status=SessionStatus.OUTPUT)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    with pytest.raises(InvalidSessionStatusTransitionError):
        await use_case.execute(
            user,
            UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.INPUT),
        )


@pytest.mark.asyncio
async def test_no_op_transition_is_rejected():
    """同一 status への遷移も許可しない（厳密モード）。"""
    repo = FakeSessionRepository()
    user = _make_user()
    session = _make_session(user.id, session_status=SessionStatus.INPUT)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    with pytest.raises(InvalidSessionStatusTransitionError):
        await use_case.execute(
            user,
            UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.INPUT),
        )


@pytest.mark.asyncio
async def test_transition_from_judged_is_rejected():
    """judged は終端。以降の遷移は許可しない。"""
    repo = FakeSessionRepository()
    user = _make_user()
    session = _make_session(user.id, session_status=SessionStatus.JUDGED)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    with pytest.raises(InvalidSessionStatusTransitionError):
        await use_case.execute(
            user,
            UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.CANCELLED),
        )


@pytest.mark.asyncio
async def test_transition_from_cancelled_is_rejected():
    """cancelled も終端。以降の遷移は許可しない。"""
    repo = FakeSessionRepository()
    user = _make_user()
    session = _make_session(user.id, session_status=SessionStatus.CANCELLED)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    with pytest.raises(InvalidSessionStatusTransitionError):
        await use_case.execute(
            user,
            UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.INPUT),
        )


@pytest.mark.asyncio
async def test_missing_session_raises_not_found():
    repo = FakeSessionRepository()
    user = _make_user()

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    with pytest.raises(SessionNotFoundError):
        await use_case.execute(
            user,
            UpdateSessionStatusCommand(session_id=uuid4(), new_status=SessionStatus.OUTPUT),
        )


@pytest.mark.asyncio
async def test_other_users_session_raises_not_found():
    """他人の session を enumerate 不能にするため、権限違反も NotFound で返す。"""
    repo = FakeSessionRepository()
    owner = _make_user()
    other = _make_user()
    session = _make_session(owner.id, session_status=SessionStatus.INPUT)
    await repo.add(session)

    use_case = UpdateSessionStatus(unit_of_work_factory=lambda: FakeUnitOfWork(sessions=repo))
    with pytest.raises(SessionNotFoundError):
        await use_case.execute(
            other,
            UpdateSessionStatusCommand(session_id=session.id, new_status=SessionStatus.OUTPUT),
        )

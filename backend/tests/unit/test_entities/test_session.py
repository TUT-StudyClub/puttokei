"""Session entity の振る舞いを検証する。"""

from datetime import UTC, datetime
from uuid import uuid4

from src.domain.entities.session import Session
from src.domain.value_objects.session_status import SessionStatus


def _make_session(
    *,
    session_status: SessionStatus = SessionStatus.INPUT,
    completed_at: datetime | None = None,
) -> Session:
    now = datetime.now(UTC)
    return Session(
        id=uuid4(),
        user_id=uuid4(),
        status=session_status,
        subject="英語",
        topic="関係代名詞",
        input_minutes=20,
        output_minutes=5,
        break_minutes=5,
        started_at=now,
        completed_at=completed_at,
        created_at=now,
    )


def test_with_status_returns_new_instance_with_updated_status():
    original = _make_session(session_status=SessionStatus.INPUT)

    updated = original.with_status(new_status=SessionStatus.OUTPUT)

    assert updated.status is SessionStatus.OUTPUT
    # 元のインスタンスは変更されない
    assert original.status is SessionStatus.INPUT


def test_with_status_applies_completed_at_when_passed():
    original = _make_session(session_status=SessionStatus.JUDGING)
    completed_at = datetime(2026, 4, 15, 10, 0, tzinfo=UTC)

    updated = original.with_status(
        new_status=SessionStatus.JUDGED,
        completed_at=completed_at,
    )

    assert updated.status is SessionStatus.JUDGED
    assert updated.completed_at == completed_at


def test_with_status_keeps_existing_completed_at_when_none_passed():
    existing_completed_at = datetime(2026, 4, 15, 9, 0, tzinfo=UTC)
    original = _make_session(
        session_status=SessionStatus.INPUT,
        completed_at=existing_completed_at,
    )

    updated = original.with_status(new_status=SessionStatus.OUTPUT)

    # completed_at を明示的に渡していないので保持される
    assert updated.completed_at == existing_completed_at


def test_session_transition_policy_allows_defined_forward_steps():
    session = _make_session(session_status=SessionStatus.INPUT)

    assert session.can_transition_to(SessionStatus.OUTPUT) is True
    assert session.can_transition_to(SessionStatus.JUDGED) is False


def test_session_output_and_judgment_phase_policy():
    output_session = _make_session(session_status=SessionStatus.OUTPUT)
    judging_session = _make_session(session_status=SessionStatus.JUDGING)

    assert output_session.can_accept_output() is True
    assert output_session.can_fetch_judgment() is False
    assert output_session.status_after_output_submission() is SessionStatus.JUDGING
    assert judging_session.can_accept_output() is True
    assert judging_session.can_fetch_judgment() is True

"""TranscribeAudio UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from src.application.use_cases.transcribe_audio import (
    SessionNotFoundError,
    TranscribeAudio,
    TranscribeAudioCommand,
)
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.services.speech_to_text_service import (
    AudioTooLargeError,
    SpeechToTextService,
    UnsupportedAudioFormatError,
)
from src.domain.value_objects.auth_provider import AuthProvider
from src.domain.value_objects.session_status import SessionStatus
from tests.fakes.fake_session_repository import FakeSessionRepository
from tests.fakes.fake_unit_of_work import FakeUnitOfWork


class _StubSttService(SpeechToTextService):
    """transcribe を呼ばれた回数 / 引数を記録するスタブ。"""

    def __init__(self, transcript: str = "テスト文字起こし") -> None:
        self.transcript = transcript
        self.call_count = 0
        self.last_audio_bytes: bytes | None = None
        self.last_mime_type: str | None = None

    async def transcribe(self, *, audio_bytes: bytes, mime_type: str) -> str:
        self.call_count += 1
        self.last_audio_bytes = audio_bytes
        self.last_mime_type = mime_type
        return self.transcript


def _make_user(user_id: UUID | None = None) -> User:
    now = datetime.now(UTC)
    return User(
        id=user_id or uuid4(),
        firebase_uid="uid",
        auth_provider=AuthProvider.GOOGLE,
        created_at=now,
        updated_at=now,
    )


def _make_session(*, user_id: UUID, session_id: UUID | None = None) -> Session:
    now = datetime.now(UTC)
    return Session(
        id=session_id or uuid4(),
        user_id=user_id,
        status=SessionStatus.OUTPUT,
        subject="英語",
        topic="関係代名詞",
        input_minutes=20,
        output_minutes=5,
        break_minutes=5,
        started_at=now,
        completed_at=None,
        created_at=now,
    )


def _build_use_case(
    *,
    speech_service: SpeechToTextService | None = None,
    sessions: FakeSessionRepository | None = None,
    max_bytes: int = 1024,
    allowed_mime_types: tuple[str, ...] = ("audio/m4a", "audio/wav"),
) -> tuple[TranscribeAudio, _StubSttService, FakeUnitOfWork]:
    stub = speech_service if isinstance(speech_service, _StubSttService) else _StubSttService()
    uow = FakeUnitOfWork(sessions=sessions)
    use_case = TranscribeAudio(
        unit_of_work_factory=lambda: uow,
        speech_service=stub,
        max_bytes=max_bytes,
        allowed_mime_types=allowed_mime_types,
    )
    return use_case, stub, uow


@pytest.mark.asyncio
async def test_returns_transcript_for_owner_session():
    user = _make_user()
    session = _make_session(user_id=user.id)
    sessions = FakeSessionRepository()
    await sessions.add(session)

    use_case, stub, _ = _build_use_case(sessions=sessions)

    result = await use_case.execute(
        user,
        TranscribeAudioCommand(
            session_id=session.id, audio_bytes=b"\xff\xff\xff", mime_type="audio/m4a"
        ),
    )

    assert result.transcript == "テスト文字起こし"
    assert stub.call_count == 1
    assert stub.last_audio_bytes == b"\xff\xff\xff"
    assert stub.last_mime_type == "audio/m4a"


@pytest.mark.asyncio
async def test_rejects_when_session_does_not_exist():
    user = _make_user()
    use_case, stub, _ = _build_use_case()

    with pytest.raises(SessionNotFoundError):
        await use_case.execute(
            user,
            TranscribeAudioCommand(session_id=uuid4(), audio_bytes=b"\xff", mime_type="audio/m4a"),
        )
    assert stub.call_count == 0


@pytest.mark.asyncio
async def test_rejects_when_session_belongs_to_other_user():
    """他ユーザー所有の session_id を詐称した呼び出しは弾く。"""
    attacker = _make_user()
    victim = _make_user()
    victim_session = _make_session(user_id=victim.id)

    sessions = FakeSessionRepository()
    await sessions.add(victim_session)

    use_case, stub, _ = _build_use_case(sessions=sessions)

    with pytest.raises(SessionNotFoundError):
        await use_case.execute(
            attacker,
            TranscribeAudioCommand(
                session_id=victim_session.id,
                audio_bytes=b"\xff",
                mime_type="audio/m4a",
            ),
        )
    assert stub.call_count == 0


@pytest.mark.asyncio
async def test_rejects_empty_audio_bytes():
    user = _make_user()
    session = _make_session(user_id=user.id)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    use_case, _, _ = _build_use_case(sessions=sessions)

    with pytest.raises(UnsupportedAudioFormatError):
        await use_case.execute(
            user,
            TranscribeAudioCommand(session_id=session.id, audio_bytes=b"", mime_type="audio/m4a"),
        )


@pytest.mark.asyncio
async def test_rejects_too_large_audio():
    user = _make_user()
    session = _make_session(user_id=user.id)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    use_case, stub, _ = _build_use_case(sessions=sessions, max_bytes=10)

    with pytest.raises(AudioTooLargeError):
        await use_case.execute(
            user,
            TranscribeAudioCommand(
                session_id=session.id, audio_bytes=b"x" * 11, mime_type="audio/m4a"
            ),
        )
    assert stub.call_count == 0


@pytest.mark.asyncio
async def test_rejects_unsupported_mime_type():
    user = _make_user()
    session = _make_session(user_id=user.id)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    use_case, stub, _ = _build_use_case(sessions=sessions, allowed_mime_types=("audio/m4a",))

    with pytest.raises(UnsupportedAudioFormatError):
        await use_case.execute(
            user,
            TranscribeAudioCommand(
                session_id=session.id, audio_bytes=b"\xff", mime_type="audio/ogg"
            ),
        )
    assert stub.call_count == 0


@pytest.mark.asyncio
async def test_mime_type_check_is_case_insensitive():
    user = _make_user()
    session = _make_session(user_id=user.id)
    sessions = FakeSessionRepository()
    await sessions.add(session)
    use_case, stub, _ = _build_use_case(sessions=sessions, allowed_mime_types=("audio/m4a",))

    result = await use_case.execute(
        user,
        TranscribeAudioCommand(session_id=session.id, audio_bytes=b"\xff", mime_type="AUDIO/M4A"),
    )
    assert result.transcript == "テスト文字起こし"
    assert stub.call_count == 1

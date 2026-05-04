"""共通 pytest fixture。

- `settings` ... テスト用に DB URL などを上書きした Settings
- `fake_user_repository` ... in-memory UserRepository
- `fake_session_repository` ... in-memory SessionRepository
- `fake_auth_verifier` ... 固定挙動の AuthVerifier
- `container` ... fake Unit of Work と fake AuthVerifier を差し込んだ Container
- `client` ... 上記 container を注入した FastAPI アプリへ httpx の AsyncClient
"""

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.application.use_cases.authenticate_user import AuthenticateUser
from src.application.use_cases.create_session import CreateSession
from src.application.use_cases.delete_account import DeleteAccount
from src.application.use_cases.get_daily_report import GetDailyReport
from src.application.use_cases.get_judgment import GetJudgment
from src.application.use_cases.get_judgment_progress import GetJudgmentProgress
from src.application.use_cases.get_user_profile import GetUserProfile
from src.application.use_cases.get_user_settings import GetUserSettings
from src.application.use_cases.get_weekly_report import GetWeeklyReport
from src.application.use_cases.list_today_outputs import ListTodayOutputs
from src.application.use_cases.submit_image_output import SubmitImageOutput
from src.application.use_cases.submit_text_output import SubmitTextOutput
from src.application.use_cases.transcribe_audio import TranscribeAudio
from src.application.use_cases.update_output_subject import UpdateOutputSubject
from src.application.use_cases.update_session_status import UpdateSessionStatus
from src.application.use_cases.update_user_profile import UpdateUserProfile
from src.application.use_cases.update_user_settings import UpdateUserSettings
from src.config import Settings
from src.container import Container
from src.infrastructure.persistence.database import Database
from src.infrastructure.speech.local_stt_service import LocalSttService
from src.main import create_app
from tests.fakes.fake_auth_verifier import FakeAuthVerifier
from tests.fakes.fake_judgment_progress_repository import FakeJudgmentProgressRepository
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository
from tests.fakes.fake_output_repository import FakeOutputRepository
from tests.fakes.fake_session_repository import FakeSessionRepository
from tests.fakes.fake_study_subject_repository import FakeStudySubjectRepository
from tests.fakes.fake_unit_of_work import FakeUnitOfWork
from tests.fakes.fake_user_repository import FakeUserRepository


@pytest.fixture
def settings() -> Settings:
    """テスト用 Settings。DB URL はダミー（実 DB 接続は fake 経由で回避する）。"""
    return Settings(
        app_env="test",
        database_url="postgresql+asyncpg://test:test@127.0.0.1:1/hourglass_test",
        firebase_project_id="hourglass-test",
        dev_mock_auth_enabled=False,
        log_level="WARNING",
    )


@pytest.fixture
def fake_user_repository() -> FakeUserRepository:
    return FakeUserRepository()


@pytest.fixture
def fake_session_repository() -> FakeSessionRepository:
    return FakeSessionRepository()


@pytest.fixture
def fake_output_repository() -> FakeOutputRepository:
    return FakeOutputRepository()


@pytest.fixture
def fake_study_subject_repository() -> FakeStudySubjectRepository:
    return FakeStudySubjectRepository()


@pytest.fixture
def fake_judgment_repository() -> FakeJudgmentRepository:
    return FakeJudgmentRepository()


@pytest.fixture
def fake_judgment_progress_repository() -> FakeJudgmentProgressRepository:
    return FakeJudgmentProgressRepository()


@pytest.fixture
def fake_auth_verifier() -> FakeAuthVerifier:
    return FakeAuthVerifier()


@pytest.fixture
def container(
    settings: Settings,
    fake_user_repository: FakeUserRepository,
    fake_session_repository: FakeSessionRepository,
    fake_output_repository: FakeOutputRepository,
    fake_study_subject_repository: FakeStudySubjectRepository,
    fake_judgment_repository: FakeJudgmentRepository,
    fake_judgment_progress_repository: FakeJudgmentProgressRepository,
    fake_auth_verifier: FakeAuthVerifier,
) -> Container:
    """fake 実装を差し込んだ Container。"""
    database = Database(database_url=settings.database_url)

    def unit_of_work_factory() -> FakeUnitOfWork:
        return FakeUnitOfWork(
            users=fake_user_repository,
            sessions=fake_session_repository,
            outputs=fake_output_repository,
            study_subjects=fake_study_subject_repository,
            judgments=fake_judgment_repository,
            judgment_progresses=fake_judgment_progress_repository,
        )

    return Container(
        settings=settings,
        database=database,
        authenticate_user=AuthenticateUser(
            auth_verifier=fake_auth_verifier,
            unit_of_work_factory=unit_of_work_factory,
        ),
        get_user_profile=GetUserProfile(),
        update_user_profile=UpdateUserProfile(unit_of_work_factory=unit_of_work_factory),
        get_user_settings=GetUserSettings(unit_of_work_factory=unit_of_work_factory),
        update_user_settings=UpdateUserSettings(unit_of_work_factory=unit_of_work_factory),
        delete_account=DeleteAccount(unit_of_work_factory=unit_of_work_factory),
        create_session=CreateSession(unit_of_work_factory=unit_of_work_factory),
        update_session_status=UpdateSessionStatus(unit_of_work_factory=unit_of_work_factory),
        submit_text_output=SubmitTextOutput(unit_of_work_factory=unit_of_work_factory),
        submit_image_output=SubmitImageOutput(unit_of_work_factory=unit_of_work_factory),
        update_output_subject=UpdateOutputSubject(unit_of_work_factory=unit_of_work_factory),
        issue_output_image_upload_url=None,
        run_text_judgment=None,
        run_image_judgment=None,
        get_judgment=GetJudgment(unit_of_work_factory=unit_of_work_factory),
        get_judgment_progress=GetJudgmentProgress(unit_of_work_factory=unit_of_work_factory),
        list_today_outputs=ListTodayOutputs(unit_of_work_factory=unit_of_work_factory),
        get_weekly_report=GetWeeklyReport(unit_of_work_factory=unit_of_work_factory),
        get_daily_report=GetDailyReport(unit_of_work_factory=unit_of_work_factory),
        transcribe_audio=TranscribeAudio(
            speech_service=LocalSttService(mock_transcript="テスト文字起こし"),
            max_bytes=settings.audio_max_bytes,
            allowed_mime_types=settings.audio_allowed_mime_types,
        ),
    )


@pytest_asyncio.fixture
async def client(settings: Settings, container: Container) -> AsyncIterator[AsyncClient]:
    """ASGITransport で lifespan を実行しながら HTTP 呼び出しできる AsyncClient。"""
    app = create_app(settings=settings, container=container)
    transport = ASGITransport(app=app)
    async with (
        AsyncClient(transport=transport, base_url="http://testserver") as ac,
        app.router.lifespan_context(app),
    ):
        yield ac

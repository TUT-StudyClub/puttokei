"""共通 pytest fixture。

- `settings` ... テスト用に DB URL などを上書きした Settings
- `fake_user_repository` ... in-memory UserRepository
- `fake_session_repository` ... in-memory SessionRepository
- `fake_auth_verifier` ... 固定挙動の AuthVerifier
- `container` ... 上記 fake を差し込んだ Container
- `client` ... 上記 container を注入した FastAPI アプリへ httpx の AsyncClient
"""

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.application.use_cases.create_session import CreateSession
from src.application.use_cases.get_user_profile import GetUserProfile
from src.application.use_cases.update_session_status import UpdateSessionStatus
from src.application.use_cases.update_user_profile import UpdateUserProfile
from src.config import Settings
from src.container import Container
from src.infrastructure.persistence.database import Database
from src.main import create_app
from tests.fakes.fake_auth_verifier import FakeAuthVerifier
from tests.fakes.fake_session_repository import FakeSessionRepository
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
def fake_auth_verifier() -> FakeAuthVerifier:
    return FakeAuthVerifier()


@pytest.fixture
def container(
    settings: Settings,
    fake_user_repository: FakeUserRepository,
    fake_session_repository: FakeSessionRepository,
    fake_auth_verifier: FakeAuthVerifier,
) -> Container:
    """fake 実装を差し込んだ Container。"""
    database = Database(database_url=settings.database_url)
    return Container(
        settings=settings,
        database=database,
        auth_verifier=fake_auth_verifier,
        user_repository=fake_user_repository,
        session_repository=fake_session_repository,
        get_user_profile=GetUserProfile(),
        update_user_profile=UpdateUserProfile(user_repository=fake_user_repository),
        create_session=CreateSession(session_repository=fake_session_repository),
        update_session_status=UpdateSessionStatus(session_repository=fake_session_repository),
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

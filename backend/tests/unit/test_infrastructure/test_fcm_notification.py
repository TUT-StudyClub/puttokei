"""FcmNotificationService の最小ユニットテスト。

実 Firebase Admin SDK を呼ばずに、`fcm_token=None` のときは送信を試みない
ことだけを mock で確認する。実 send 経路は CI 上で flaky になるためテストしない。
"""

from datetime import UTC, datetime
from unittest.mock import patch
from uuid import uuid4

import pytest

from src.config import Settings
from src.domain.entities.user import User
from src.domain.value_objects.auth_provider import AuthProvider
from src.infrastructure.notification.fcm_notification import FcmNotificationService


def _make_user(*, fcm_token: str | None) -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid="uid-fcm-001",
        auth_provider=AuthProvider.GOOGLE,
        display_name=None,
        age_group=None,
        onboarding_completed=True,
        fcm_token=fcm_token,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_send_to_user_skips_when_fcm_token_is_none():
    settings = Settings(
        app_env="test",
        database_url="postgresql+asyncpg://test:test@127.0.0.1:1/x",
        firebase_project_id="hourglass-test",
        log_level="WARNING",
    )
    service = FcmNotificationService(settings=settings)
    user = _make_user(fcm_token=None)

    with patch("src.infrastructure.notification.fcm_notification.messaging.send") as send_mock:
        await service.send_to_user(user, title="t", body="b")

    send_mock.assert_not_called()

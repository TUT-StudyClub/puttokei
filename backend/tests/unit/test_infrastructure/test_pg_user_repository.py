"""PgUserRepository の SQLAlchemy mock を使った単体テスト。

実 DB を叩く integration test は別途整備するが、本ファイルでは Anonymous ↔ Apple/Google
リンクで auth_provider が書き換わる挙動を最低限担保する。AsyncSession を AsyncMock で
差し替え、`model.auth_provider = ...` の代入が起きていることを確認する。
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.user import User
from src.domain.value_objects.auth_provider import AuthProvider
from src.infrastructure.persistence.repositories.pg_user_repository import PgUserRepository


def _make_user(auth_provider: AuthProvider = AuthProvider.APPLE) -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid="linked-user",
        auth_provider=auth_provider,
        created_at=now,
        updated_at=now,
    )


def _build_session_returning(model: MagicMock) -> AsyncMock:
    """`session.execute(...).scalar_one()` で渡した model を返す session mock を作る。"""
    session = AsyncMock(spec=AsyncSession)
    execute_result = MagicMock()
    execute_result.scalar_one = MagicMock(return_value=model)
    session.execute.return_value = execute_result
    return session


@pytest.mark.asyncio
async def test_update_writes_auth_provider_value():
    # Anonymous → Apple へのリンク後、authenticate_user が `update()` を呼ぶ際に
    # ORM model の auth_provider カラムが新しい値で書き換わることを確認する。
    model = MagicMock()
    model.auth_provider = AuthProvider.ANONYMOUS.value
    session = _build_session_returning(model)

    repo = PgUserRepository(session)
    user = _make_user(auth_provider=AuthProvider.APPLE)

    await repo.update(user)

    assert model.auth_provider == AuthProvider.APPLE.value
    session.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_writes_other_mutable_columns():
    # auth_provider 以外の更新対象も同じ経路で書かれることを担保する。
    model = MagicMock()
    session = _build_session_returning(model)

    repo = PgUserRepository(session)
    user = _make_user()

    await repo.update(user)

    assert model.display_name == user.display_name
    assert model.onboarding_completed == user.onboarding_completed
    assert model.fcm_token == user.fcm_token
    assert model.updated_at == user.updated_at

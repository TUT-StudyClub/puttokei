"""Firebase Admin SDK を使った外部認証ユーザの削除。

Firebase Admin SDK の `auth.delete_user` は同期 API のため、FastAPI の event loop を
ブロックしないよう anyio の to_thread で別スレッドへ逃がす。

既存の `FirebaseAuthVerifier` と同じく、Settings から credential を解決し、`id(self)`
ベースのユニーク name で `initialize_app` する。同一プロセス内に複数の Firebase App が
共存することを許容するパターンで、Verifier の app と二重初期化エラーになるのを避ける。
"""

from __future__ import annotations

import logging
from functools import partial
from typing import TYPE_CHECKING

import anyio.to_thread
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from src.domain.services.auth_account_admin import (
    AuthAccountAdmin,
    AuthAccountNotFoundError,
)

if TYPE_CHECKING:
    from src.config import Settings


logger = logging.getLogger(__name__)


class FirebaseAuthAccountAdmin(AuthAccountAdmin):
    """Firebase Auth 上のユーザを削除するアダプタ。"""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._app: firebase_admin.App | None = None

    async def delete_user(self, uid: str) -> None:
        app = self._get_app()
        logger.info(
            "firebase delete_user start uid=%s project=%s app=%s",
            uid,
            self._settings.firebase_project_id,
            app.name,
        )
        try:
            await anyio.to_thread.run_sync(partial(firebase_auth.delete_user, uid, app=app))
        except firebase_auth.UserNotFoundError as exc:
            logger.warning("firebase delete_user not_found uid=%s", uid)
            raise AuthAccountNotFoundError(uid) from exc
        except Exception:
            logger.exception("firebase delete_user failed uid=%s", uid)
            raise
        else:
            logger.info("firebase delete_user success uid=%s", uid)

    def _get_app(self) -> firebase_admin.App:
        """Firebase Admin SDK の App を遅延初期化する。"""
        if self._app is not None:
            return self._app
        cred_path = self._settings.firebase_credentials_path
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        # 同一プロセス内で複数回初期化されないよう、Verifier 側と被らない一意な name を付ける。
        self._app = firebase_admin.initialize_app(
            cred,
            {"projectId": self._settings.firebase_project_id},
            name=f"hourglass-account-admin-{id(self)}",
        )
        logger.info(
            "firebase admin app initialized name=%s project=%s cred_path=%s",
            self._app.name,
            self._settings.firebase_project_id,
            cred_path,
        )
        return self._app

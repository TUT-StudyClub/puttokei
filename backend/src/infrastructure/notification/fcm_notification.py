"""Firebase Cloud Messaging での通知送信。"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

import firebase_admin
from firebase_admin import credentials, messaging
from firebase_admin.exceptions import FirebaseError

from src.domain.entities.user import User
from src.domain.services.notification_service import (
    NotificationDeliveryError,
    NotificationService,
)

if TYPE_CHECKING:
    from src.config import Settings

logger = logging.getLogger(__name__)


class FcmNotificationService(NotificationService):
    """Firebase Admin SDK 経由で FCM へ push 通知を送る実装。"""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._app: firebase_admin.App | None = None

    async def send_to_user(
        self,
        user: User,
        *,
        title: str,
        body: str,
        data: dict[str, str] | None = None,
    ) -> None:
        if user.fcm_token is None:
            return
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=user.fcm_token,
        )
        try:
            await asyncio.to_thread(messaging.send, message, app=self._get_app())
        except FirebaseError as exc:
            logger.warning("FCM 送信に失敗: user_id=%s reason=%s", user.id, exc)
            raise NotificationDeliveryError(str(exc)) from exc

    def _get_app(self) -> firebase_admin.App:
        """Firebase Admin SDK の App を遅延初期化する。

        FirebaseAuthVerifier と分離するため、本サービス専用の name を付ける。
        """
        if self._app is not None:
            return self._app
        cred_path = self._settings.firebase_credentials_path
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        self._app = firebase_admin.initialize_app(
            cred,
            {"projectId": self._settings.firebase_project_id},
            name=f"hourglass-fcm-{id(self)}",
        )
        return self._app

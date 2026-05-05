"""push 通知送信サービスの抽象 IF。

具体実装は `infrastructure/notification/fcm_notification.py` で組み立てる。
application 層 / presentation 層からは本インタフェース経由でのみ通知送信を呼ぶ。
"""

from abc import ABC, abstractmethod

from src.domain.entities.user import User


class NotificationDeliveryError(Exception):
    """通知送信が失敗した場合に送出される。"""


class NotificationService(ABC):
    """push 通知送信サービス。"""

    @abstractmethod
    async def send_to_user(
        self,
        user: User,
        *,
        title: str,
        body: str,
        data: dict[str, str] | None = None,
    ) -> None:
        """指定ユーザに通知を送信する。

        `user.fcm_token` が None の場合は no-op として扱い、例外を送出しない。
        token が無効化された場合などの送信失敗時は NotificationDeliveryError を投げる。
        """

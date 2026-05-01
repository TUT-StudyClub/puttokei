"""テスト用 NotificationService 実装。

実 Firebase Admin SDK を使わずに、送信呼び出しを記録するだけの fake。
"""

from src.domain.entities.user import User
from src.domain.services.notification_service import NotificationService


class FakeNotificationService(NotificationService):
    """送信引数を sent に蓄積する in-memory 実装。"""

    def __init__(self) -> None:
        self.sent: list[dict[str, object]] = []

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
        self.sent.append(
            {
                "user_id": user.id,
                "fcm_token": user.fcm_token,
                "title": title,
                "body": body,
                "data": dict(data or {}),
            }
        )

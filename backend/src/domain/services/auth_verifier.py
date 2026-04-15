"""ID Token 検証サービスの抽象 IF。

具体実装は `infrastructure/auth/firebase_auth.py` にあり、Composition Root で組み立てる。
presentation 層は本インタフェース経由でのみ検証処理を呼ぶ。
"""

from abc import ABC, abstractmethod
from typing import TypedDict


class VerifiedToken(TypedDict):
    """検証済みトークンから取り出した必要情報。"""

    uid: str
    sign_in_provider: str


class InvalidTokenError(Exception):
    """トークンが無効 / 期限切れ / 形式不正のときに送出される。"""


class AuthVerifier(ABC):
    """ID Token の検証器。"""

    @abstractmethod
    def verify_id_token(self, token: str) -> VerifiedToken:
        """トークンを検証して UID / プロバイダ情報を返す。失敗時は InvalidTokenError。"""

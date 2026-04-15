"""Firebase Admin SDK を使った ID Token の検証。

本番では `firebase_admin.auth.verify_id_token` を使う。
開発環境かつ `dev_mock_auth_enabled=True` の場合のみ、`dev-mock-<uid>[:provider]`
形式のトークンを検証せずに UID / プロバイダを返す。これにより #32（Apple/Google
サインイン）と #33（/api/v1/auth/verify）が未実装でも profile API の動作確認ができる。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from src.domain.services.auth_verifier import (
    AuthVerifier,
    InvalidTokenError,
    VerifiedToken,
)

if TYPE_CHECKING:
    from src.config import Settings


class FirebaseAuthVerifier(AuthVerifier):
    """ID Token の検証器。dev モックトークンと実 Firebase 検証の両方を扱う。"""

    _DEV_MOCK_PREFIX = "dev-mock-"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._app: firebase_admin.App | None = None

    def verify_id_token(self, token: str) -> VerifiedToken:
        if self._settings.dev_mock_auth_enabled and token.startswith(self._DEV_MOCK_PREFIX):
            return self._decode_mock_token(token)
        return self._decode_firebase_token(token)

    def _decode_mock_token(self, token: str) -> VerifiedToken:
        payload = token.removeprefix(self._DEV_MOCK_PREFIX)
        if not payload:
            raise InvalidTokenError("dev mock token の UID が空です")
        # "dev-mock-<uid>" または "dev-mock-<uid>:<provider>" を許容する
        if ":" in payload:
            uid, provider = payload.split(":", 1)
        else:
            uid, provider = payload, "google.com"
        if not uid:
            raise InvalidTokenError("dev mock token の UID が空です")
        return VerifiedToken(uid=uid, sign_in_provider=provider)

    def _decode_firebase_token(self, token: str) -> VerifiedToken:
        try:
            decoded = firebase_auth.verify_id_token(token, app=self._get_app())
        except (firebase_auth.InvalidIdTokenError, firebase_auth.ExpiredIdTokenError) as exc:
            raise InvalidTokenError(str(exc)) from exc
        except ValueError as exc:
            raise InvalidTokenError(str(exc)) from exc
        uid = decoded.get("uid")
        provider = decoded.get("firebase", {}).get("sign_in_provider", "google.com")
        if not isinstance(uid, str) or not uid:
            raise InvalidTokenError("verified token に uid が含まれていません")
        return VerifiedToken(uid=uid, sign_in_provider=provider)

    def _get_app(self) -> firebase_admin.App:
        """Firebase Admin SDK の App を遅延初期化する。"""
        if self._app is not None:
            return self._app
        cred_path = self._settings.firebase_credentials_path
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        # 同一プロセス内で複数回初期化されないよう、一意な name を付ける。
        self._app = firebase_admin.initialize_app(
            cred,
            {"projectId": self._settings.firebase_project_id},
            name=f"hourglass-{id(self)}",
        )
        return self._app

"""テスト用の AuthVerifier 実装。"""

from src.domain.services.auth_verifier import (
    AuthVerifier,
    InvalidTokenError,
    VerifiedToken,
)


class FakeAuthVerifier(AuthVerifier):
    """`Bearer <uid>` / `Bearer <uid>:<provider>` 形式を UID とみなすだけの検証器。

    ``invalid-<...>`` で始まるトークンは InvalidTokenError を投げる。
    """

    def verify_id_token(self, token: str) -> VerifiedToken:
        if not token or token.startswith("invalid-"):
            raise InvalidTokenError("fake verifier: invalid token")
        if ":" in token:
            uid, provider = token.split(":", 1)
        else:
            uid, provider = token, "google.com"
        return VerifiedToken(uid=uid, sign_in_provider=provider)

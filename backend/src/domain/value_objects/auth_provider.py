"""認証プロバイダを表す値オブジェクト。Firebase Auth の sign_in_provider に対応する。"""

from enum import Enum


class AuthProvider(str, Enum):
    """サインイン元のプロバイダ。"""

    APPLE = "apple"
    GOOGLE = "google"
    ANONYMOUS = "anonymous"

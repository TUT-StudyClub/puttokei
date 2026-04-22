"""LLM プロバイダー共通例外。"""


class LLMProviderError(Exception):
    """LLM プロバイダーの基底例外。"""


class LLMTimeoutError(LLMProviderError):
    """LLM リクエストがタイムアウトした。"""


class LLMRateLimitError(LLMProviderError):
    """LLM プロバイダーのレートリミットに達した。"""


class LLMResponseParseError(LLMProviderError):
    """LLM の応答を期待スキーマへ変換できなかった。"""


class LLMAuthenticationError(LLMProviderError):
    """LLM プロバイダーの認証に失敗した。"""


class LLMUnknownError(LLMProviderError):
    """その他の想定外エラー。"""

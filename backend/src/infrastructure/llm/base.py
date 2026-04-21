"""LLM プロバイダー共通の例外とユーティリティ。"""

from __future__ import annotations


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


def provider_error_from_status_code(
    status_code: int, message: str | None = None
) -> LLMProviderError:
    """HTTP ステータスコードから共通例外へ変換する。"""

    detail = message or f"LLM provider request failed with status code {status_code}."
    if status_code == 429:
        return LLMRateLimitError(detail)
    if status_code in {401, 403}:
        return LLMAuthenticationError(detail)
    return LLMUnknownError(detail)

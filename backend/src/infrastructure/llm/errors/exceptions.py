"""LLM プロバイダー共通例外。"""

from __future__ import annotations

from typing import ClassVar


class LLMProviderError(Exception):
    """LLM プロバイダーの基底例外。"""

    http_status_codes: ClassVar[frozenset[int]] = frozenset()
    _http_status_error_types: ClassVar[list[type[LLMProviderError]]] = []

    def __init_subclass__(cls, **kwargs: object) -> None:
        super().__init_subclass__(**kwargs)
        if cls.http_status_codes:
            LLMProviderError._http_status_error_types.append(cls)

    @classmethod
    def from_status_code(
        cls,
        status_code: int,
        message: str | None = None,
    ) -> LLMProviderError:
        detail = message or f"LLM provider request failed with status code {status_code}."
        for error_type in cls._http_status_error_types:
            if status_code in error_type.http_status_codes:
                return error_type(detail)
        return LLMUnknownError(detail)


class LLMTimeoutError(LLMProviderError):
    """LLM リクエストがタイムアウトした。"""


class LLMRateLimitError(LLMProviderError):
    """LLM プロバイダーのレートリミットに達した。"""

    http_status_codes: ClassVar[frozenset[int]] = frozenset({429})


class LLMAuthenticationError(LLMProviderError):
    """LLM プロバイダーの認証に失敗した。"""

    http_status_codes: ClassVar[frozenset[int]] = frozenset({401, 403})


class LLMUnknownError(LLMProviderError):
    """その他の想定外エラー。"""

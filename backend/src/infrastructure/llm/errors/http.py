"""HTTP エラーから LLM 例外へ変換するヘルパー。"""

from src.infrastructure.llm.errors.exceptions import (
    LLMAuthenticationError,
    LLMProviderError,
    LLMRateLimitError,
    LLMUnknownError,
)


def provider_error_from_status_code(
    status_code: int,
    message: str | None = None,
) -> LLMProviderError:
    """HTTP ステータスコードから共通例外へ変換する。"""

    detail = message or f"LLM provider request failed with status code {status_code}."
    if status_code == 429:
        return LLMRateLimitError(detail)
    if status_code in {401, 403}:
        return LLMAuthenticationError(detail)
    return LLMUnknownError(detail)

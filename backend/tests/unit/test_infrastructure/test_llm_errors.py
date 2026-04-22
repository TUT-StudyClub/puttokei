"""LLM error helpers の unit tests。"""

from src.infrastructure.llm.errors import (
    LLMAuthenticationError,
    LLMRateLimitError,
    LLMUnknownError,
    provider_error_from_status_code,
)


def test_provider_error_from_status_code_maps_rate_limit() -> None:
    error = provider_error_from_status_code(429, "too many requests")

    assert isinstance(error, LLMRateLimitError)
    assert str(error) == "too many requests"


def test_provider_error_from_status_code_maps_authentication() -> None:
    unauthorized = provider_error_from_status_code(401)
    forbidden = provider_error_from_status_code(403)

    assert isinstance(unauthorized, LLMAuthenticationError)
    assert isinstance(forbidden, LLMAuthenticationError)


def test_provider_error_from_status_code_falls_back_to_unknown_error() -> None:
    error = provider_error_from_status_code(500)

    assert isinstance(error, LLMUnknownError)
    assert str(error) == "LLM provider request failed with status code 500."

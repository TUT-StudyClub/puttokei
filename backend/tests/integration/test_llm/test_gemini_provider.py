"""GeminiProvider の結合テスト。"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from types import SimpleNamespace
from typing import Any

import pytest
from google.genai import errors

from src.domain.services.llm_judge_service import LLMJudgmentInput, TokenUsage
from src.infrastructure.llm.base import (
    LLMAuthenticationError,
    LLMRateLimitError,
    LLMResponseParseError,
    LLMTimeoutError,
    LLMUnknownError,
)
from src.infrastructure.llm.gemini_provider import GeminiProvider
from tests.integration.test_llm.contracts import BaseLLMProviderContract


class TestGeminiProviderContract(BaseLLMProviderContract):
    @pytest.fixture
    def provider(
        self,
        mock_gemini_client: dict[str, Any],
        build_gemini_response: Callable[..., SimpleNamespace],
        sample_gemini_payload: dict[str, object],
    ) -> GeminiProvider:
        mock_gemini_client["generate_content"].return_value = build_gemini_response(
            sample_gemini_payload
        )
        return GeminiProvider(api_key="test-key")


@pytest.mark.asyncio
async def test_gemini_provider_returns_llm_judgment_output(
    mock_gemini_client: dict[str, Any],
    build_gemini_response: Callable[..., SimpleNamespace],
    sample_gemini_payload: dict[str, object],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].return_value = build_gemini_response(
        sample_gemini_payload,
        prompt_tokens=21,
        completion_tokens=13,
    )
    provider = GeminiProvider(api_key="test-key")

    result = await provider.judge(sample_llm_input)

    assert result.provider_name == "gemini"
    assert result.model_name == "gemini-3-flash-preview"
    assert result.verdict == "partial"
    assert result.score == 78
    assert result.token_usage == TokenUsage(prompt_tokens=21, completion_tokens=13)


@pytest.mark.asyncio
async def test_gemini_provider_includes_input_fields_in_prompt(
    mock_gemini_client: dict[str, Any],
    build_gemini_response: Callable[..., SimpleNamespace],
    sample_gemini_payload: dict[str, object],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].return_value = build_gemini_response(
        sample_gemini_payload
    )
    provider = GeminiProvider(api_key="test-key")

    await provider.judge(sample_llm_input)

    mock_gemini_client["generate_content"].assert_awaited_once()
    kwargs = mock_gemini_client["generate_content"].await_args.kwargs
    contents = kwargs["contents"]
    assert sample_llm_input.subject in contents
    assert sample_llm_input.topic in contents
    assert sample_llm_input.content in contents
    assert sample_llm_input.age_group in contents


@pytest.mark.asyncio
async def test_gemini_provider_uses_prompt_version_branching(
    mock_gemini_client: dict[str, Any],
    build_gemini_response: Callable[..., SimpleNamespace],
    sample_gemini_payload: dict[str, object],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].return_value = build_gemini_response(
        sample_gemini_payload
    )
    provider = GeminiProvider(api_key="test-key")

    result = await provider.judge(sample_llm_input)

    assert result.model_name == "gemini-3-flash-preview"

    unsupported = sample_llm_input.__class__(
        subject=sample_llm_input.subject,
        topic=sample_llm_input.topic,
        content=sample_llm_input.content,
        age_group=sample_llm_input.age_group,
        prompt_version="v999",
    )
    with pytest.raises(ValueError, match="Unsupported prompt version"):
        await provider.judge(unsupported)


@pytest.mark.asyncio
async def test_gemini_provider_reflects_generation_settings(
    mock_gemini_client: dict[str, Any],
    build_gemini_response: Callable[..., SimpleNamespace],
    sample_gemini_payload: dict[str, object],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].return_value = build_gemini_response(
        sample_gemini_payload
    )
    provider = GeminiProvider(
        api_key="test-key",
        model="gemini-custom-model",
        thinking_level="HIGH",
        temperature=0.4,
    )

    await provider.judge(sample_llm_input)

    kwargs = mock_gemini_client["generate_content"].await_args.kwargs
    config = kwargs["config"]
    assert kwargs["model"] == "gemini-custom-model"
    assert config.temperature == 0.4
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema is not None
    assert config.thinking_config.thinking_level.value == "HIGH"


@pytest.mark.asyncio
async def test_gemini_provider_raises_parse_error_on_invalid_json(
    mock_gemini_client: dict[str, Any],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].return_value = SimpleNamespace(
        text="{invalid-json",
        usage_metadata=None,
    )
    provider = GeminiProvider(api_key="test-key")

    with pytest.raises(LLMResponseParseError):
        await provider.judge(sample_llm_input)


@pytest.mark.asyncio
async def test_gemini_provider_raises_parse_error_on_schema_mismatch(
    mock_gemini_client: dict[str, Any],
    build_gemini_response: Callable[..., SimpleNamespace],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].return_value = build_gemini_response(
        {"verdict": "correct", "score": 80}
    )
    provider = GeminiProvider(api_key="test-key")

    with pytest.raises(LLMResponseParseError):
        await provider.judge(sample_llm_input)


@pytest.mark.asyncio
async def test_gemini_provider_raises_timeout_error(
    mock_gemini_client: dict[str, Any],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].side_effect = TimeoutError
    provider = GeminiProvider(api_key="test-key", timeout_seconds=1)

    with pytest.raises(LLMTimeoutError):
        await provider.judge(sample_llm_input)


@pytest.mark.asyncio
async def test_gemini_provider_raises_rate_limit_error(
    mock_gemini_client: dict[str, Any],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].side_effect = errors.ClientError(
        429,
        {"error": {"status": "RESOURCE_EXHAUSTED", "message": "too many requests"}},
        None,
    )
    provider = GeminiProvider(api_key="test-key")

    with pytest.raises(LLMRateLimitError):
        await provider.judge(sample_llm_input)


@pytest.mark.asyncio
async def test_gemini_provider_raises_authentication_error_for_401(
    mock_gemini_client: dict[str, Any],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].side_effect = errors.ClientError(
        401,
        {"error": {"status": "UNAUTHENTICATED", "message": "bad auth"}},
        None,
    )
    provider = GeminiProvider(api_key="test-key")

    with pytest.raises(LLMAuthenticationError):
        await provider.judge(sample_llm_input)


@pytest.mark.asyncio
async def test_gemini_provider_raises_authentication_error_for_403(
    mock_gemini_client: dict[str, Any],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].side_effect = errors.ClientError(
        403,
        {"error": {"status": "PERMISSION_DENIED", "message": "forbidden"}},
        None,
    )
    provider = GeminiProvider(api_key="test-key")

    with pytest.raises(LLMAuthenticationError):
        await provider.judge(sample_llm_input)


@pytest.mark.asyncio
async def test_gemini_provider_raises_unknown_error_for_other_api_errors(
    mock_gemini_client: dict[str, Any],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    mock_gemini_client["generate_content"].side_effect = errors.ServerError(
        500,
        {"error": {"status": "INTERNAL", "message": "boom"}},
        None,
    )
    provider = GeminiProvider(api_key="test-key")

    with pytest.raises(LLMUnknownError):
        await provider.judge(sample_llm_input)


def test_gemini_provider_requires_api_key() -> None:
    with pytest.raises(LLMAuthenticationError):
        GeminiProvider(api_key="")


@pytest.mark.asyncio
async def test_gemini_provider_reports_latency_ms(
    mock_gemini_client: dict[str, Any],
    build_gemini_response: Callable[..., SimpleNamespace],
    sample_gemini_payload: dict[str, object],
    sample_llm_input: LLMJudgmentInput,
) -> None:
    async def _slow_response(**_: object):
        await asyncio.sleep(0.02)
        return build_gemini_response(sample_gemini_payload)

    mock_gemini_client["generate_content"].side_effect = _slow_response
    provider = GeminiProvider(api_key="test-key")

    result = await provider.judge(sample_llm_input)

    assert result.latency_ms >= 20

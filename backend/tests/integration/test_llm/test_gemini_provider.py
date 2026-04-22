"""GeminiProvider の結合テスト。"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from functools import partial
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from google.genai import errors
from pytest_mock import MockerFixture

from src.config import LLMSettings
from src.domain.services.llm_judge_service import TokenUsage
from src.infrastructure.llm.errors import (
    LLMAuthenticationError,
    LLMRateLimitError,
    LLMResponseParseError,
    LLMTimeoutError,
    LLMUnknownError,
)
from src.infrastructure.llm.gemini_provider import GeminiProvider
from tests.integration.test_llm.contracts import SAMPLE_LLM_INPUT, LLMProviderContract

SAMPLE_GEMINI_PAYLOAD: dict[str, object] = {
    "verdict": "partial",
    "score": 78,
    "items": [
        {
            "claim": "光合成は二酸化炭素と水を使う",
            "correct": True,
            "feedback": "主な材料を正しく捉えています。",
        },
        {
            "claim": "生成物はデンプンと酸素",
            "correct": True,
            "feedback": "生成物の理解も概ね正しいです。",
        },
    ],
    "advice": "葉緑体や光の役割も補足できるとより良いです。",
}


def _build_gemini_response(
    payload: dict[str, object] | None = None,
    *,
    prompt_tokens: int = 11,
    completion_tokens: int = 7,
) -> SimpleNamespace:
    return SimpleNamespace(
        text=json.dumps(payload or {}),
        usage_metadata=SimpleNamespace(
            prompt_token_count=prompt_tokens,
            candidates_token_count=completion_tokens,
        ),
    )


async def _slow_gemini_response(
    response: SimpleNamespace,
    **_: object,
) -> SimpleNamespace:
    await asyncio.sleep(0.02)
    return response


@dataclass(frozen=True)
class MockGeminiClient:
    client: MagicMock
    generate_content: AsyncMock


@pytest.fixture
def mock_gemini_client(mocker: MockerFixture) -> MockGeminiClient:
    generate_content = AsyncMock()
    client = mocker.MagicMock()
    client.aio = mocker.MagicMock()
    client.aio.models = mocker.MagicMock()
    client.aio.models.generate_content = generate_content
    mocker.patch(
        "src.infrastructure.llm.gemini_provider.Client",
        return_value=client,
    )
    return MockGeminiClient(
        client=client,
        generate_content=generate_content,
    )


def _build_llm_settings(**overrides: object) -> LLMSettings:
    payload = {
        "provider": "gemini",
        "gemini_api_key": "test-key",
        "gemini_model": "gemini-3-flash-preview",
        "gemini_thinking_level": "MEDIUM",
        "gemini_temperature": 0.2,
        "timeout_seconds": 30,
        **overrides,
    }
    return LLMSettings.model_construct(**payload)


def _build_provider(**overrides: object) -> GeminiProvider:
    setting_overrides = {
        "gemini_model": overrides.pop("model", "gemini-3-flash-preview"),
        "gemini_thinking_level": overrides.pop("thinking_level", "MEDIUM"),
        "gemini_temperature": overrides.pop("temperature", 0.2),
        "timeout_seconds": overrides.pop("timeout_seconds", 30),
        **overrides,
    }
    return GeminiProvider.from_settings(_build_llm_settings(**setting_overrides))


class TestGeminiProviderContract(LLMProviderContract):
    @pytest.fixture
    def provider(
        self,
        mock_gemini_client: MockGeminiClient,
    ) -> GeminiProvider:
        mock_gemini_client.generate_content.return_value = _build_gemini_response(
            SAMPLE_GEMINI_PAYLOAD
        )
        return _build_provider()


@pytest.mark.asyncio
async def test_gemini_provider_returns_llm_judgment_output(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.return_value = _build_gemini_response(
        SAMPLE_GEMINI_PAYLOAD,
        prompt_tokens=21,
        completion_tokens=13,
    )
    provider = _build_provider()

    result = await provider.judge(SAMPLE_LLM_INPUT)

    assert result.provider_name == "gemini"
    assert result.model_name == "gemini-3-flash-preview"
    assert result.verdict == "partial"
    assert result.score == 78
    assert result.token_usage == TokenUsage(prompt_tokens=21, completion_tokens=13)


@pytest.mark.asyncio
async def test_gemini_provider_includes_input_fields_in_prompt(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.return_value = _build_gemini_response(SAMPLE_GEMINI_PAYLOAD)
    provider = _build_provider()

    await provider.judge(SAMPLE_LLM_INPUT)

    mock_gemini_client.generate_content.assert_awaited_once()
    await_args = mock_gemini_client.generate_content.await_args
    assert await_args is not None
    kwargs = await_args.kwargs
    contents = kwargs["contents"]
    assert SAMPLE_LLM_INPUT.subject in contents
    assert SAMPLE_LLM_INPUT.topic in contents
    assert SAMPLE_LLM_INPUT.content in contents
    assert SAMPLE_LLM_INPUT.age_group in contents


@pytest.mark.asyncio
async def test_gemini_provider_reflects_generation_settings(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.return_value = _build_gemini_response(SAMPLE_GEMINI_PAYLOAD)
    provider = _build_provider(
        model="gemini-custom-model",
        thinking_level="HIGH",
        temperature=0.4,
    )

    await provider.judge(SAMPLE_LLM_INPUT)

    await_args = mock_gemini_client.generate_content.await_args
    assert await_args is not None
    kwargs = await_args.kwargs
    config = kwargs["config"]
    assert kwargs["model"] == "gemini-custom-model"
    assert config.temperature == 0.4
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema is not None
    assert config.thinking_config.thinking_level.value == "HIGH"


@pytest.mark.asyncio
async def test_gemini_provider_raises_parse_error_on_invalid_json(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.return_value = SimpleNamespace(
        text="{invalid-json",
        usage_metadata=None,
    )
    provider = _build_provider()

    with pytest.raises(LLMResponseParseError):
        await provider.judge(SAMPLE_LLM_INPUT)


@pytest.mark.asyncio
async def test_gemini_provider_raises_parse_error_on_schema_mismatch(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.return_value = _build_gemini_response(
        {"verdict": "correct", "score": 80}
    )
    provider = _build_provider()

    with pytest.raises(LLMResponseParseError):
        await provider.judge(SAMPLE_LLM_INPUT)


@pytest.mark.asyncio
async def test_gemini_provider_raises_timeout_error(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.side_effect = TimeoutError
    provider = _build_provider(timeout_seconds=1)

    with pytest.raises(LLMTimeoutError):
        await provider.judge(SAMPLE_LLM_INPUT)


@pytest.mark.asyncio
async def test_gemini_provider_raises_rate_limit_error(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.side_effect = errors.ClientError(
        429,
        {"error": {"status": "RESOURCE_EXHAUSTED", "message": "too many requests"}},
        None,
    )
    provider = _build_provider()

    with pytest.raises(LLMRateLimitError):
        await provider.judge(SAMPLE_LLM_INPUT)


@pytest.mark.asyncio
async def test_gemini_provider_raises_authentication_error_for_401(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.side_effect = errors.ClientError(
        401,
        {"error": {"status": "UNAUTHENTICATED", "message": "bad auth"}},
        None,
    )
    provider = _build_provider()

    with pytest.raises(LLMAuthenticationError):
        await provider.judge(SAMPLE_LLM_INPUT)


@pytest.mark.asyncio
async def test_gemini_provider_raises_authentication_error_for_403(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.side_effect = errors.ClientError(
        403,
        {"error": {"status": "PERMISSION_DENIED", "message": "forbidden"}},
        None,
    )
    provider = _build_provider()

    with pytest.raises(LLMAuthenticationError):
        await provider.judge(SAMPLE_LLM_INPUT)


@pytest.mark.asyncio
async def test_gemini_provider_raises_unknown_error_for_other_api_errors(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.side_effect = errors.ServerError(
        500,
        {"error": {"status": "INTERNAL", "message": "boom"}},
        None,
    )
    provider = _build_provider()

    with pytest.raises(LLMUnknownError):
        await provider.judge(SAMPLE_LLM_INPUT)


def test_gemini_provider_requires_api_key_from_settings() -> None:
    with pytest.raises(LLMAuthenticationError):
        GeminiProvider.from_settings(_build_llm_settings(gemini_api_key=""))


@pytest.mark.asyncio
async def test_gemini_provider_reports_latency_ms(
    mock_gemini_client: MockGeminiClient,
) -> None:
    mock_gemini_client.generate_content.side_effect = partial(
        _slow_gemini_response,
        _build_gemini_response(SAMPLE_GEMINI_PAYLOAD),
    )
    provider = _build_provider()

    result = await provider.judge(SAMPLE_LLM_INPUT)

    assert result.latency_ms >= 20

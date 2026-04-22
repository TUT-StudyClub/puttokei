"""実 Gemini API を使う最小 smoke test。"""

import pytest
from google.genai import Client

from src.config import LLMSettings
from src.domain.services.llm_judge_service import LLMJudgmentInput
from src.infrastructure.llm.gemini_provider import GeminiProvider


@pytest.mark.asyncio
async def test_gemini_smoke_returns_structured_output():
    settings = LLMSettings()
    provider = GeminiProvider(
        client=Client(api_key=settings.gemini_api_key),
        model=settings.gemini_model,
        thinking_level=settings.gemini_thinking_level,
        temperature=settings.gemini_temperature,
        timeout_seconds=settings.timeout_seconds,
    )

    result = await provider.judge(
        LLMJudgmentInput(
            subject="理科",
            topic="光合成",
            content=(
                "光合成は植物が光エネルギーを使って二酸化炭素と水から"
                "有機物を作り、酸素を放出するはたらきです。"
            ),
            age_group="10s",
        )
    )

    assert result.provider_name == "gemini"
    assert result.model_name == settings.gemini_model
    assert result.verdict in {"correct", "partial", "incorrect", "rejected"}
    assert 0 <= result.score <= 100
    assert result.items
    assert result.advice
    assert result.latency_ms < 60000

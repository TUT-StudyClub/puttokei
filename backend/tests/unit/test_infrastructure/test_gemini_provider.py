import json

import httpx
import pytest

from src.infrastructure.llm.gemini_provider import GeminiProvider, GeminiProviderError


@pytest.mark.asyncio
async def test_gemini_provider_parses_structured_output_and_builds_request():
    captured_request: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_request["url"] = str(request.url)
        captured_request["headers"] = dict(request.headers)
        captured_request["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(
            status_code=200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "verdict": "incorrect",
                                            "score": 24,
                                            "advice": "事実関係を整理し直しましょう。",
                                            "corrections": [
                                                {
                                                    "target_text": "1+1=3",
                                                    "correct_text": "1+1=2",
                                                    "explanation": "1 と 1 の和は 2 です。",
                                                }
                                            ],
                                        },
                                        ensure_ascii=False,
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        )

    provider = GeminiProvider(
        api_key="test-api-key",
        model="gemini-3-flash-preview",
        temperature=0.2,
        timeout_seconds=30,
        thinking_level="MEDIUM",
        transport=httpx.MockTransport(handler),
    )

    result = await provider.judge(prompt_input="足し算", user_output="1+1=3")

    assert result.verdict.value == "incorrect"
    assert result.score == 24
    assert result.corrections[0].target_text == "1+1=3"

    request_url = captured_request["url"]
    assert isinstance(request_url, str)
    assert request_url.endswith("/models/gemini-3-flash-preview:generateContent")

    headers = captured_request["headers"]
    assert isinstance(headers, dict)
    assert headers["x-goog-api-key"] == "test-api-key"

    body = captured_request["body"]
    assert isinstance(body, dict)
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert body["generationConfig"]["thinkingConfig"] == {"thinkingLevel": "medium"}
    assert "足し算" in body["contents"][0]["parts"][0]["text"]
    assert "1+1=3" in body["contents"][0]["parts"][0]["text"]


@pytest.mark.asyncio
async def test_gemini_provider_uses_stable_generate_content_when_progress_callback_is_passed():
    captured_request: dict[str, object] = {}
    progress_chunks: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_request["url"] = str(request.url)
        captured_request["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(
            status_code=200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "verdict": "correct",
                                            "score": 90,
                                            "advice": "よくできています。",
                                            "corrections": [],
                                        },
                                        ensure_ascii=False,
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        )

    async def report_progress(chunk_count: int) -> None:
        progress_chunks.append(chunk_count)

    provider = GeminiProvider(
        api_key="test-api-key",
        model="gemini-3-flash-preview",
        temperature=0.2,
        timeout_seconds=30,
        transport=httpx.MockTransport(handler),
    )

    result = await provider.judge(
        prompt_input="足し算",
        user_output="1+1=2",
        progress_callback=report_progress,
    )

    assert result.verdict.value == "correct"
    assert result.score == 90
    assert progress_chunks == []
    request_url = captured_request["url"]
    assert isinstance(request_url, str)
    assert request_url.endswith("/models/gemini-3-flash-preview:generateContent")


@pytest.mark.asyncio
async def test_gemini_provider_raises_error_when_response_is_not_valid_judgment_result():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "verdict": "incorrect",
                                            "score": 120,
                                            "advice": "不正なレスポンス",
                                            "corrections": [],
                                        },
                                        ensure_ascii=False,
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        )

    provider = GeminiProvider(
        api_key="test-api-key",
        model="gemini-3-flash-preview",
        temperature=0.2,
        timeout_seconds=30,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(GeminiProviderError):
        await provider.judge(prompt_input="本能寺の変", user_output="明智光秀は本能寺の変で死んだ")

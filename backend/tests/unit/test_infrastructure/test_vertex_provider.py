"""VertexProvider のユニットテスト。

google-genai SDK の Client を mock してネットワークを伴わずに、
リクエスト構築 / レスポンスパース / エラーハンドリングを検証する。
"""

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.infrastructure.llm.vertex_provider import VertexProvider, VertexProviderError


class _StubResponse:
    """google-genai の GenerateContentResponse を模した最小スタブ。"""

    def __init__(self, text: str) -> None:
        self.text = text


def _build_provider_with_mocked_client(
    response: _StubResponse,
    captured: dict[str, Any] | None = None,
) -> VertexProvider:
    """Client.aio.models.generate_content をモックした VertexProvider を返す。"""
    captured_dict = captured if captured is not None else {}

    async def fake_generate_content(**kwargs: object) -> _StubResponse:
        captured_dict["model"] = kwargs["model"]
        captured_dict["contents"] = kwargs["contents"]
        captured_dict["config"] = kwargs["config"]
        return response

    with patch("src.infrastructure.llm.vertex_provider.genai.Client") as mock_client_cls:
        client_instance = MagicMock()
        models_async = MagicMock()
        models_async.generate_content = AsyncMock(side_effect=fake_generate_content)
        client_instance.aio.models = models_async
        mock_client_cls.return_value = client_instance

        return VertexProvider(
            project_id="hourglass-f10ca",
            location="asia-northeast1",
            model="gemini-3-flash-preview",
            temperature=0.2,
            timeout_seconds=30,
            thinking_budget=512,
            image_media_resolution="high",
            credentials_path=None,
        )


@pytest.mark.asyncio
async def test_vertex_provider_judge_text_parses_structured_output_and_builds_request():
    payload = json.dumps(
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
    captured: dict[str, Any] = {}
    provider = _build_provider_with_mocked_client(_StubResponse(payload), captured=captured)

    result = await provider.judge_text(prompt_input="足し算", user_output="1+1=3")

    assert result.verdict.value == "incorrect"
    assert result.score == 24
    assert result.corrections[0].target_text == "1+1=3"

    assert captured["model"] == "gemini-3-flash-preview"
    config = captured["config"]
    assert config.response_mime_type == "application/json"
    assert config.thinking_config.thinking_budget == 512
    # text 判定では media_resolution は付与しない。
    assert config.media_resolution is None
    # contents の最後の part に user_output が乗っているか。
    contents = captured["contents"]
    text_part = contents[0].parts[0].text
    assert "足し算" in text_part
    assert "1+1=3" in text_part


@pytest.mark.asyncio
async def test_vertex_provider_judge_image_attaches_inline_data_and_media_resolution():
    payload = json.dumps(
        {
            "verdict": "correct",
            "score": 90,
            "advice": "よくできています。",
            "corrections": [],
        },
        ensure_ascii=False,
    )
    captured: dict[str, Any] = {}
    provider = _build_provider_with_mocked_client(_StubResponse(payload), captured=captured)

    result = await provider.judge_image(
        prompt_input="本能寺の変",
        image_bytes=b"\xff\xd8\xff\xe0fake-jpeg",
        image_mime_type="image/jpeg",
    )

    assert result.verdict.value == "correct"

    config = captured["config"]
    # 画像時は high (= MEDIA_RESOLUTION_HIGH) が付与されている。
    assert config.media_resolution is not None
    assert "HIGH" in config.media_resolution.name

    contents = captured["contents"]
    parts = contents[0].parts
    # 画像 part が先頭、prompt が末尾の構成。
    assert parts[0].inline_data is not None
    assert parts[0].inline_data.mime_type == "image/jpeg"
    assert parts[0].inline_data.data == b"\xff\xd8\xff\xe0fake-jpeg"
    assert "本能寺の変" in parts[1].text


@pytest.mark.asyncio
async def test_vertex_provider_progress_callback_is_intentionally_ignored():
    payload = json.dumps(
        {
            "verdict": "correct",
            "score": 90,
            "advice": "よくできています。",
            "corrections": [],
        },
        ensure_ascii=False,
    )
    progress_chunks: list[int] = []

    async def report_progress(chunk_count: int) -> None:
        progress_chunks.append(chunk_count)

    provider = _build_provider_with_mocked_client(_StubResponse(payload))

    result = await provider.judge_text(
        prompt_input="足し算",
        user_output="1+1=2",
        progress_callback=report_progress,
    )

    assert result.verdict.value == "correct"
    # 安定優先で streaming は使わないため callback は呼ばれない。
    assert progress_chunks == []


@pytest.mark.asyncio
async def test_vertex_provider_raises_error_when_response_is_not_valid_judgment_result():
    invalid_payload = json.dumps(
        {
            "verdict": "incorrect",
            "score": 120,  # 0-100 の範囲外
            "advice": "不正なレスポンス",
            "corrections": [],
        },
        ensure_ascii=False,
    )
    provider = _build_provider_with_mocked_client(_StubResponse(invalid_payload))

    with pytest.raises(VertexProviderError):
        await provider.judge_text(
            prompt_input="本能寺の変",
            user_output="明智光秀は本能寺の変で死んだ",
        )

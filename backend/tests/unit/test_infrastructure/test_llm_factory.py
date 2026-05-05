from unittest.mock import patch

import pytest

from src.config import Settings
from src.infrastructure.llm.factory import build_llm_judge_service
from src.infrastructure.llm.local_judge_service import LocalJudgeService
from src.infrastructure.llm.vertex_provider import VertexProvider


def test_build_llm_judge_service_returns_local_service_for_local_provider():
    settings = Settings(llm_provider="local")

    service = build_llm_judge_service(settings)

    assert isinstance(service, LocalJudgeService)


def test_build_llm_judge_service_returns_vertex_provider_when_project_id_is_set_explicitly():
    settings = Settings(
        llm_provider="vertex",
        llm_vertex_project_id="hourglass-f10ca",
        llm_vertex_location="asia-northeast1",
        llm_vertex_model="gemini-3-flash-preview",
        llm_vertex_temperature=0.2,
        llm_timeout_seconds=30,
    )

    with patch("src.infrastructure.llm.vertex_provider.genai.Client"):
        service = build_llm_judge_service(settings)

    assert isinstance(service, VertexProvider)


def test_build_llm_judge_service_falls_back_to_gcs_project_id_when_vertex_project_id_unset():
    settings = Settings(
        llm_provider="vertex",
        llm_vertex_project_id=None,
        gcs_project_id="hourglass-f10ca",
        llm_vertex_location="asia-northeast1",
    )

    with patch("src.infrastructure.llm.vertex_provider.genai.Client"):
        service = build_llm_judge_service(settings)

    assert isinstance(service, VertexProvider)


def test_build_llm_judge_service_requires_project_id_for_vertex_provider():
    # vertex 指定だが project_id も gcs_project_id も未設定 → 失敗。
    settings = Settings(
        llm_provider="vertex",
        llm_vertex_project_id=None,
        gcs_project_id=None,
    )

    with pytest.raises(ValueError, match="LLM_VERTEX_PROJECT_ID"):
        build_llm_judge_service(settings)

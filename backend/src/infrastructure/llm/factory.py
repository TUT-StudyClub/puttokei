"""LLM プロバイダーのファクトリ。"""

from src.config import Settings
from src.domain.services.llm_judge_service import LLMJudgeService
from src.infrastructure.llm.local_judge_service import LocalJudgeService
from src.infrastructure.llm.vertex_provider import VertexProvider


def build_llm_judge_service(settings: Settings) -> LLMJudgeService:
    """Settings に応じた LLMJudgeService 実装を返す。"""
    if settings.llm_provider == "local":
        return LocalJudgeService()

    if settings.llm_provider == "vertex":
        # Vertex AI の project は LLM_VERTEX_PROJECT_ID 優先、未指定なら GCS_PROJECT_ID を流用。
        # GCS と同じ GCP プロジェクトで運用する想定なので fallback で十分。
        project_id = settings.llm_vertex_project_id or settings.gcs_project_id
        if not project_id:
            raise ValueError(
                "LLM_PROVIDER=vertex の場合は LLM_VERTEX_PROJECT_ID か GCS_PROJECT_ID が必要です。"
            )
        return VertexProvider(
            project_id=project_id,
            location=settings.llm_vertex_location,
            model=settings.llm_vertex_model,
            temperature=settings.llm_vertex_temperature,
            timeout_seconds=settings.llm_timeout_seconds,
            thinking_budget=settings.llm_vertex_thinking_budget,
            image_media_resolution=settings.llm_vertex_image_media_resolution,
            credentials_path=settings.gcs_credentials_path,
        )

    raise ValueError(f"unsupported llm provider: {settings.llm_provider}")

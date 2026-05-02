"""アプリケーション設定。環境変数を pydantic-settings で読み込む。"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """環境変数から構築される設定値。"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production", "test"] = Field(
        default="development",
        description="アプリ実行環境",
    )
    database_url: str = Field(
        default="postgresql+asyncpg://hourglass:hourglass@localhost:5432/hourglass",
        description="非同期 SQLAlchemy 用の接続文字列",
    )
    firebase_project_id: str = Field(
        default="hourglass-dev",
        description="Firebase プロジェクト ID",
    )
    firebase_credentials_path: str | None = Field(
        default=None,
        description="Firebase Admin SDK のサービスアカウント鍵ファイルパス。未指定時は ADC",
    )
    dev_mock_auth_enabled: bool = Field(
        default=False,
        description=(
            "dev-mock-<uid> 形式のトークンを Firebase 検証なしで受け入れる。"
            "ローカル開発専用のフラグ"
        ),
    )
    local_judgment_enabled: bool = Field(
        default=False,
        description="Cloud Tasks を使わず、アウトプット送信時にローカル判定を保存する。",
    )
    llm_provider: Literal["local", "vertex"] = Field(
        default="local",
        description="アウトプット判定で使う LLM プロバイダー。"
        "local はルールベース mock、vertex は Vertex AI 経由の Gemini。",
    )
    llm_vertex_project_id: str | None = Field(
        default=None,
        description=(
            "Vertex AI を呼び出す GCP プロジェクト ID。"
            "未指定時は GCS_PROJECT_ID を fallback に使う（同じ GCP プロジェクトで運用する想定）。"
        ),
    )
    llm_vertex_credentials_path: str | None = Field(
    default=None,
    description=(
        "Vertex AI 認証用サービスアカウント鍵 JSON のパス。"
        "未指定時は ADC を使う。GCS_CREDENTIALS_PATH とは分離する。"
    ),
    )
    llm_vertex_location: str = Field(
        default="global",
        description=(
            "Vertex AI のリージョン。Gemini 3 系の preview モデルは global エンドポイント"
            "でのみ提供されるため既定は global。正式リリース後は asia-northeast1 等に切替可能。"
        ),
    )
    llm_vertex_model: str = Field(
        default="gemini-3-flash-preview",
        description="Vertex AI 経由で使う Gemini モデル名。",
    )
    llm_vertex_thinking_budget: int | None = Field(
        default=None,
        description=(
            "Gemini の thinking 上限トークン数。未指定ならモデル既定値。"
            "0 で thinking を実質的に無効化、大きい値でじっくり考えさせる。"
        ),
    )
    llm_vertex_temperature: float = Field(
        default=0.2,
        ge=0,
        le=2,
        description="Gemini の temperature。",
    )
    llm_vertex_image_media_resolution: Literal["low", "medium", "high"] = Field(
        default="high",
        description="Gemini multimodal で画像に割り当てるトークン解像度。",
    )
    llm_timeout_seconds: float = Field(
        default=30,
        gt=0,
        description="LLM API 呼び出しのタイムアウト秒。",
    )
    gcs_project_id: str | None = Field(
        default=None,
        description="GCS bucket を所有する GCP プロジェクト ID。未指定時は ADC を使う。",
    )
    gcs_output_image_bucket: str | None = Field(
        default=None,
        description="アウトプット画像を保存する GCS バケット名。",
    )
    gcs_credentials_path: str | None = Field(
        default=None,
        description=(
            "GCS 認証用サービスアカウント鍵 JSON のパス。"
            "未指定時は ADC を使う（その場合 signed URL 発行に private key が必要なので"
            "Cloud Run 等の workload identity 環境では別途対応が必要）。"
        ),
    )
    gcs_signed_upload_url_ttl_seconds: int = Field(
        default=600,
        gt=0,
        description="アップロード用 signed URL の有効期限（秒）。",
    )
    gcs_signed_download_url_ttl_seconds: int = Field(
        default=900,
        gt=0,
        description="閲覧用 signed URL の有効期限（秒）。",
    )
    output_image_max_bytes: int = Field(
        default=5 * 1024 * 1024,
        gt=0,
        description="アウトプット画像の最大バイト数。",
    )
    output_image_allowed_mime_types: tuple[str, ...] = Field(
        default=("image/jpeg", "image/png"),
        description="許可するアウトプット画像の MIME type。",
    )
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="ログレベル",
    )


@lru_cache
def get_settings() -> Settings:
    """設定インスタンスをキャッシュ付きで返す。"""
    return Settings()

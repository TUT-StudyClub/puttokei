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
    llm_provider: Literal["local", "gemini"] = Field(
        default="local",
        description="ローカル同期判定で使う LLM プロバイダー。",
    )
    llm_gemini_api_key: str | None = Field(
        default=None,
        description="Gemini Developer API の API キー。",
    )
    llm_gemini_model: str = Field(
        default="gemini-3-flash-preview",
        description="Gemini のモデル名。",
    )
    llm_gemini_thinking_level: str | None = Field(
        default=None,
        description="Gemini 3 系で使う thinking level。例: low / medium / high。",
    )
    llm_gemini_temperature: float = Field(
        default=0.2,
        ge=0,
        le=2,
        description="Gemini の temperature。",
    )
    llm_timeout_seconds: float = Field(
        default=30,
        gt=0,
        description="LLM API 呼び出しのタイムアウト秒。",
    )
    llm_text_prompt_version: str = Field(
        default="v1",
        description="テキスト判定で使うプロンプトのバージョン。",
    )
    llm_image_prompt_version: str = Field(
        default="v1",
        description="画像判定で使うプロンプトのバージョン。",
    )
    llm_gemini_image_media_resolution: Literal["low", "medium", "high"] = Field(
        default="high",
        description="Gemini multimodal で画像に割り当てるトークン解像度。",
    )
    gcs_project_id: str | None = Field(
        default=None,
        description="GCS bucket を所有する GCP プロジェクト ID。未指定時は ADC を使う。",
    )
    gcs_output_image_bucket: str | None = Field(
        default=None,
        description="アウトプット画像を保存する GCS バケット名。",
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

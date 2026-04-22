"""アプリケーション設定。環境変数を pydantic-settings で読み込む。"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

type GeminiThinkingLevel = Literal["MINIMAL", "LOW", "MEDIUM", "HIGH"]


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
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="ログレベル",
    )


class LLMSettings(BaseSettings):
    """LLM プロバイダー用の設定。"""

    model_config = SettingsConfigDict(
        env_prefix="LLM_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    provider: str = Field(
        default="gemini",
        description="利用する LLM プロバイダー",
    )
    gemini_api_key: str = Field(
        ...,
        min_length=1,
        description="Gemini API キー",
    )
    gemini_model: str = Field(
        default="gemini-3-flash-preview",
        description="Gemini のモデル ID",
    )
    gemini_thinking_level: GeminiThinkingLevel = Field(
        default="MEDIUM",
        description="Gemini の thinking level",
    )
    gemini_temperature: float = Field(
        default=0.2,
        ge=0.0,
        le=2.0,
        description="Gemini の temperature",
    )
    timeout_seconds: int = Field(
        default=30,
        ge=1,
        description="LLM リクエストのタイムアウト秒数",
    )


@lru_cache
def get_settings() -> Settings:
    """設定インスタンスをキャッシュ付きで返す。"""
    return Settings()

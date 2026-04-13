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
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="ログレベル",
    )


@lru_cache
def get_settings() -> Settings:
    """設定インスタンスをキャッシュ付きで返す。"""
    return Settings()

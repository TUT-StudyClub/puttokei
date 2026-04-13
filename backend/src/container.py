"""DI 組み立てのエントリ（Composition Root）。

後続 Epic でリポジトリ・サービスの実装を差し込む。
今は health endpoint しか持たないため、コンテナは設定保持と DB エンジン管理のみ行う。
"""

from pydantic import BaseModel, ConfigDict

from src.config import Settings
from src.infrastructure.persistence.database import Database


class Container(BaseModel):
    """アプリ全体で共有する依存物。

    後続 Epic では UseCase / Repository / Service の組み立てもここに集約する。
    Database など非 Pydantic 型を含むため arbitrary_types_allowed を有効化する。
    """

    model_config = ConfigDict(arbitrary_types_allowed=True, frozen=True)

    settings: Settings
    database: Database


def build_container(settings: Settings) -> Container:
    """Settings から Container を組み立てる。"""
    database = Database(database_url=settings.database_url)
    return Container(settings=settings, database=database)

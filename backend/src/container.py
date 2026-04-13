"""DI 組み立てのエントリ（Composition Root）。

後続 Epic でリポジトリ・サービスの実装を差し込む。
今は health endpoint しか持たないため、コンテナは設定保持と DB エンジン管理のみ行う。
"""

from dataclasses import dataclass

from src.config import Settings
from src.infrastructure.persistence.database import Database


@dataclass
class Container:
    """アプリ全体で共有する依存物。

    後続 Epic では UseCase / Repository / Service の組み立てもここに集約する。
    """

    settings: Settings
    database: Database


def build_container(settings: Settings) -> Container:
    """Settings から Container を組み立てる。"""
    database = Database(database_url=settings.database_url)
    return Container(settings=settings, database=database)

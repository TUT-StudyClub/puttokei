"""アウトプット画像ストレージの抽象 IF。

実装は infrastructure/storage に置く。signed URL の発行と画像 bytes の取得は
application 層の use case から呼ばれる。
"""

from abc import ABC, abstractmethod


class OutputImageStorage(ABC):
    """アウトプット画像を保管するストレージの抽象 IF。"""

    @abstractmethod
    def issue_upload_url(
        self,
        *,
        storage_path: str,
        content_type: str,
        ttl_seconds: int,
    ) -> str:
        """指定 path に対して PUT 可能な signed URL を発行する。"""

    @abstractmethod
    def issue_download_url(
        self,
        *,
        storage_path: str,
        ttl_seconds: int,
    ) -> str:
        """指定 path を GET 可能な signed URL を発行する。"""

    @abstractmethod
    async def download(self, *, storage_path: str) -> tuple[bytes, str]:
        """指定 path の画像を読み出して (bytes, content_type) を返す。"""

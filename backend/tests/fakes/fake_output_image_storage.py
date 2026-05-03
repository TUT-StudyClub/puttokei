"""インメモリな OutputImageStorage 実装。"""

from src.domain.services.output_image_storage import OutputImageStorage


class FakeOutputImageStorage(OutputImageStorage):
    """in-memory な OutputImageStorage。テスト以外で使用しない。"""

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.upload_calls: list[tuple[str, str, int]] = []
        self.download_calls: list[str] = []
        self.download_url_calls: list[tuple[str, int]] = []
        self.delete_calls: list[str] = []

    def issue_upload_url(
        self,
        *,
        storage_path: str,
        content_type: str,
        ttl_seconds: int,
    ) -> str:
        self.upload_calls.append((storage_path, content_type, ttl_seconds))
        return f"https://fake.storage/upload/{storage_path}?ct={content_type}&ttl={ttl_seconds}"

    def issue_download_url(
        self,
        *,
        storage_path: str,
        ttl_seconds: int,
    ) -> str:
        self.download_url_calls.append((storage_path, ttl_seconds))
        return f"https://fake.storage/download/{storage_path}?ttl={ttl_seconds}"

    async def download(self, *, storage_path: str) -> tuple[bytes, str]:
        self.download_calls.append(storage_path)
        return self.objects.get(storage_path, (b"", "application/octet-stream"))

    async def delete(self, *, storage_path: str) -> None:
        self.delete_calls.append(storage_path)
        self.objects.pop(storage_path, None)

    def put(self, storage_path: str, data: bytes, content_type: str) -> None:
        """テスト用に画像オブジェクトを直接登録する。"""
        self.objects[storage_path] = (data, content_type)

"""Google Cloud Storage を使う OutputImageStorage 実装。"""

import asyncio
from datetime import timedelta

from google.cloud import storage

from src.domain.services.output_image_storage import OutputImageStorage


class GcsOutputImageStorage(OutputImageStorage):
    """GCS bucket にアウトプット画像を保管する。

    認証はデフォルトで ADC (`GOOGLE_APPLICATION_CREDENTIALS` または
    Cloud Run のサービスアカウント) を使う。Cloud Run では署名鍵を持たないため、
    将来 IAM signBlob 経由の signed URL 発行に拡張する余地あり。
    """

    def __init__(self, *, project_id: str | None, bucket_name: str) -> None:
        self._client = (
            storage.Client(project=project_id) if project_id else storage.Client()
        )
        self._bucket = self._client.bucket(bucket_name)

    def issue_upload_url(
        self,
        *,
        storage_path: str,
        content_type: str,
        ttl_seconds: int,
    ) -> str:
        blob = self._bucket.blob(storage_path)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=ttl_seconds),
            method="PUT",
            content_type=content_type,
        )

    def issue_download_url(
        self,
        *,
        storage_path: str,
        ttl_seconds: int,
    ) -> str:
        blob = self._bucket.blob(storage_path)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=ttl_seconds),
            method="GET",
        )

    async def download(self, *, storage_path: str) -> tuple[bytes, str]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._download_sync, storage_path)

    def _download_sync(self, storage_path: str) -> tuple[bytes, str]:
        blob = self._bucket.blob(storage_path)
        blob.reload()
        data = blob.download_as_bytes()
        return data, blob.content_type or "application/octet-stream"

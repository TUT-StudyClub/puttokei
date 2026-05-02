"""Google Cloud Storage を使う OutputImageStorage 実装。"""

import asyncio
from datetime import timedelta

from google.cloud import storage
from google.oauth2 import service_account

from src.domain.services.output_image_storage import OutputImageStorage


class GcsOutputImageStorage(OutputImageStorage):
    """GCS bucket にアウトプット画像を保管する。

    `credentials_path` が指定されていればサービスアカウント鍵 JSON から
    認証情報を読み込む。未指定なら ADC（環境変数 / metadata server）に頼る。
    Signed URL の発行には private key を持つ credentials が必要なので、
    ローカル開発では `credentials_path` を指定する想定。Cloud Run 等の
    workload identity 環境では IAM signBlob 経由の signed URL 発行に
    拡張する余地あり。
    """

    def __init__(
        self,
        *,
        project_id: str | None,
        bucket_name: str,
        credentials_path: str | None = None,
    ) -> None:
        client_kwargs: dict[str, object] = {}
        if project_id is not None:
            client_kwargs["project"] = project_id
        if credentials_path is not None:
            client_kwargs["credentials"] = service_account.Credentials.from_service_account_file(
                credentials_path
            )
        self._client = storage.Client(**client_kwargs)
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

    async def delete(self, *, storage_path: str) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._delete_sync, storage_path)

    def _delete_sync(self, storage_path: str) -> None:
        # `if_generation_match=None` ではなく単純削除。既に無い場合 NotFound を吐くが
        # best-effort なので呼び出し側で握りつぶす想定。ここでは raise させたまま返す。
        blob = self._bucket.blob(storage_path)
        blob.delete()

"""Google Cloud Storage を使う OutputImageStorage 実装。"""

import asyncio
from datetime import timedelta

import google.auth
from google.auth import credentials as google_credentials
from google.auth.transport import requests as google_auth_requests
from google.cloud import storage
from google.oauth2 import service_account

from src.domain.services.output_image_storage import OutputImageStorage

# IAM SignBlob を含む GCP 各種 API へアクセスするための広域スコープ。
_DEFAULT_SCOPES = ("https://www.googleapis.com/auth/cloud-platform",)


class GcsOutputImageStorage(OutputImageStorage):
    """GCS bucket にアウトプット画像を保管する。

    Signed URL の発行戦略:
    - `credentials_path` が指定されている場合: サービスアカウント鍵 JSON を読み込み、
      鍵に含まれる private key で直接 v4 署名する。ローカル開発向け。
    - 未指定の場合: ADC（環境変数 / metadata server）から credentials を取り、
      Blob.generate_signed_url の `service_account_email` / `access_token` 引数経由で
      IAM SignBlob API に署名を委譲する。Cloud Run 等の workload identity 環境向け。
      ランタイム SA に対し、自分自身への `roles/iam.serviceAccountTokenCreator` が必要。
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

        signing_credentials: google_credentials.Credentials | None = None
        if credentials_path is not None:
            client_kwargs["credentials"] = service_account.Credentials.from_service_account_file(
                credentials_path
            )
            # SA キーは private key を保持しており、generate_signed_url 単独で署名できる。
        else:
            adc_credentials, _ = google.auth.default(scopes=list(_DEFAULT_SCOPES))
            client_kwargs["credentials"] = adc_credentials
            # private key を持たないため、署名時に IAM SignBlob 経由へフォールバックする。
            signing_credentials = adc_credentials

        self._client = storage.Client(**client_kwargs)
        self._bucket = self._client.bucket(bucket_name)
        self._signing_credentials = signing_credentials

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
            **self._build_signing_kwargs(),
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
            **self._build_signing_kwargs(),
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

    def _build_signing_kwargs(self) -> dict[str, object]:
        """ADC 経由の場合に generate_signed_url が IAM SignBlob を使うための引数を返す。"""
        if self._signing_credentials is None:
            return {}
        if not self._signing_credentials.valid:
            self._signing_credentials.refresh(google_auth_requests.Request())

        service_account_email = getattr(self._signing_credentials, "service_account_email", None)
        if service_account_email is None:
            # `gcloud auth application-default login` 由来の user credentials は
            # service_account_email を持たないため IAM SignBlob を呼べない。
            # ローカルでこのコードに到達した場合は GCS_CREDENTIALS_PATH を設定する。
            raise RuntimeError(
                "ADC credentials do not expose 'service_account_email'. "
                "Provide a service account key via GCS_CREDENTIALS_PATH for local development, "
                "or run on a workload identity environment (Cloud Run, GCE, GKE)."
            )
        return {
            "service_account_email": service_account_email,
            "access_token": self._signing_credentials.token,
        }

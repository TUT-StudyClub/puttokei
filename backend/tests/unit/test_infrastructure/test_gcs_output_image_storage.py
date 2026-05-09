import pytest

from src.infrastructure.storage.gcs_output_image_storage import GcsOutputImageStorage


class _FakeAdcCredentials:
    def __init__(
        self,
        *,
        service_account_email_after_refresh: str | None,
        access_value_after_refresh: str,
    ) -> None:
        self.valid = False
        self.token: str | None = None
        self.service_account_email: str | None = None
        self.refresh_calls = 0
        self._service_account_email_after_refresh = service_account_email_after_refresh
        self._access_value_after_refresh = access_value_after_refresh

    def refresh(self, _request: object) -> None:
        self.refresh_calls += 1
        self.valid = True
        self.token = self._access_value_after_refresh
        self.service_account_email = self._service_account_email_after_refresh


def _build_storage_with_signing_credentials(
    credentials: _FakeAdcCredentials | None,
) -> GcsOutputImageStorage:
    storage = GcsOutputImageStorage.__new__(GcsOutputImageStorage)
    storage._signing_credentials = credentials
    return storage


def test_build_signing_kwargs_returns_empty_when_using_service_account_key():
    storage = _build_storage_with_signing_credentials(None)

    assert storage._build_signing_kwargs() == {}


def test_build_signing_kwargs_refreshes_adc_before_reading_service_account_email():
    credentials = _FakeAdcCredentials(
        service_account_email_after_refresh="runtime-sa@example.iam.gserviceaccount.com",
        access_value_after_refresh="access-value",
    )
    storage = _build_storage_with_signing_credentials(credentials)

    signing_kwargs = storage._build_signing_kwargs()

    assert credentials.refresh_calls == 1
    assert signing_kwargs == {
        "service_account_email": "runtime-sa@example.iam.gserviceaccount.com",
        "access_token": "access-value",
    }


def test_build_signing_kwargs_rejects_adc_without_service_account_email():
    credentials = _FakeAdcCredentials(
        service_account_email_after_refresh=None,
        access_value_after_refresh="access-value",
    )
    storage = _build_storage_with_signing_credentials(credentials)

    with pytest.raises(RuntimeError, match="service_account_email"):
        storage._build_signing_kwargs()

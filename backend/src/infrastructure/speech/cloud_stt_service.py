"""Google Cloud Speech-to-Text v2 を使った文字起こし実装。

`google-cloud-speech` の `speech_v2` モジュールを使い、`recognize` で
同期的に文字起こしを行う。

2 つの構成をサポートする:

1. **ad-hoc recognizer (`_`) + `location=global`**
   recognizer リソースを事前作成せず、リクエスト毎に config を渡す。
   制約: model は global 提供のもの (latest_long / latest_short / long /
   short) に限られ、chirp_2 は使えない。

2. **事前作成 recognizer + リージョナル endpoint**
   `recognizer_id` を指定すると `{location}-speech.googleapis.com` の
   リージョナル endpoint を使い、保存済みの recognizer リソースを名前で
   参照する。chirp_2 等の global 非提供モデルを使う場合に必要。

ローカル開発: ``credentials_path`` でサービスアカウント鍵 JSON を渡す。
Cloud Run 等: ``credentials_path=None`` で ADC が実行サービスアカウント
として使われる。
"""

import asyncio

from google.api_core import exceptions as gax_exceptions
from google.api_core.client_options import ClientOptions
from google.cloud import speech_v2
from google.oauth2 import service_account

from src.domain.services.speech_to_text_service import (
    SpeechToTextError,
    SpeechToTextService,
    TranscriptionTimeoutError,
)


class CloudSttService(SpeechToTextService):
    """Cloud Speech-to-Text v2 を呼び出す実装。"""

    def __init__(
        self,
        *,
        project_id: str,
        location: str = "global",
        model: str = "latest_long",
        language: str = "ja-JP",
        enable_punctuation: bool = True,
        timeout_seconds: float = 120,
        credentials_path: str | None = None,
        recognizer_id: str | None = None,
    ) -> None:
        self._project_id = project_id
        self._location = location
        self._model = model
        self._language = language
        self._enable_punctuation = enable_punctuation
        self._timeout = timeout_seconds
        self._recognizer_id = recognizer_id

        try:
            credentials = (
                service_account.Credentials.from_service_account_file(
                    credentials_path,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"],
                )
                if credentials_path is not None
                else None
            )
            # 事前作成 recognizer をリージョン上に置く場合、リクエストはリージョナル
            # endpoint に向けないと 404 になる。global recognizer のときはデフォルト
            # endpoint で OK。
            client_options = (
                ClientOptions(api_endpoint=f"{location}-speech.googleapis.com")
                if recognizer_id is not None and location != "global"
                else None
            )
            self._client = speech_v2.SpeechAsyncClient(
                credentials=credentials,
                client_options=client_options,
            )
        except Exception as exc:
            raise SpeechToTextError(
                "Cloud Speech-to-Text クライアントの初期化に失敗しました "
                f"(project={project_id}, location={location}, "
                f"recognizer_id={recognizer_id or '<ad-hoc>'}, "
                f"credentials_path={credentials_path or '<ADC>'}): {exc}"
            ) from exc

    async def transcribe(self, *, audio_bytes: bytes, mime_type: str) -> str:
        # mime_type は AutoDetectDecodingConfig に任せるので参照しない
        del mime_type

        config = speech_v2.RecognitionConfig(
            auto_decoding_config=speech_v2.AutoDetectDecodingConfig(),
            language_codes=[self._language],
            model=self._model,
            features=speech_v2.RecognitionFeatures(
                enable_automatic_punctuation=self._enable_punctuation,
            ),
        )
        recognizer_name = self._recognizer_id or "_"
        request = speech_v2.RecognizeRequest(
            recognizer=(
                f"projects/{self._project_id}/locations/{self._location}"
                f"/recognizers/{recognizer_name}"
            ),
            config=config,
            content=audio_bytes,
        )

        try:
            response = await asyncio.wait_for(
                self._client.recognize(request=request),
                timeout=self._timeout,
            )
        except TimeoutError as exc:
            raise TranscriptionTimeoutError(
                f"Cloud Speech-to-Text 呼び出しが {self._timeout}s でタイムアウトしました。"
            ) from exc
        except gax_exceptions.GoogleAPICallError as exc:
            raise SpeechToTextError(f"Cloud Speech-to-Text 呼び出しに失敗しました: {exc}") from exc
        except Exception as exc:
            raise SpeechToTextError(
                f"Cloud Speech-to-Text 呼び出し中に予期しないエラー: {exc}"
            ) from exc

        return " ".join(
            result.alternatives[0].transcript for result in response.results if result.alternatives
        ).strip()

"""音声 → テキスト変換 (Speech-to-Text) の抽象 IF。

具体実装は `infrastructure/speech/*.py` に置き、`infrastructure/speech/factory.py`
で組み立てる。
"""

from abc import ABC, abstractmethod


class SpeechToTextError(RuntimeError):
    """文字起こし処理の汎用エラー。"""


class AudioTooLargeError(SpeechToTextError):
    """音声バイト列がサイズ上限を超過。"""


class UnsupportedAudioFormatError(SpeechToTextError):
    """音声 MIME type がサポート対象外。"""


class TranscriptionTimeoutError(SpeechToTextError):
    """文字起こし呼び出しがタイムアウト。"""


class SpeechToTextService(ABC):
    """音声バイトを受けて文字起こし結果を返す抽象 IF。"""

    @abstractmethod
    async def transcribe(
        self,
        *,
        audio_bytes: bytes,
        mime_type: str,
    ) -> str:
        """audio_bytes をテキストに変換する。

        実装側の責務:
        - 言語 / モデル / 句読点設定は実装時に固定 or Settings 経由で受ける
        - timeout 管理
        - エラーは ``SpeechToTextError`` (or サブクラス) として伝搬
        """

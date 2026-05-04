"""テスト / ローカル開発用の SpeechToTextService 実装。

実 API を呼ばず、固定文字列 (or 設定で渡された transcript) を返す。
unit test と CI を Cloud STT API キー無しで走らせるための mock。
"""

from src.domain.services.speech_to_text_service import SpeechToTextService

_DEFAULT_MOCK_TRANSCRIPT = "（ローカルモック文字起こし結果）"


class LocalSttService(SpeechToTextService):
    """常に固定文字列を返す mock 実装。"""

    def __init__(self, *, mock_transcript: str = _DEFAULT_MOCK_TRANSCRIPT) -> None:
        self._mock_transcript = mock_transcript

    async def transcribe(self, *, audio_bytes: bytes, mime_type: str) -> str:
        # 実 API を呼ばないので audio_bytes / mime_type は読み捨てる
        del audio_bytes, mime_type
        return self._mock_transcript

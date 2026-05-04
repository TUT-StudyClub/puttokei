"""音声 → テキスト変換の UseCase。

mobile から受け取った音声バイト列を Cloud STT で文字起こしし、
結果テキストを返すだけの薄い UseCase。判定 (LLM) には流さず、
mobile 側で表示・編集後に既存の text 提出フローを使う想定。

URL の path 上に session_id を含む経路で呼ばれるため、UseCase でも
``current_user`` 所有のセッションかどうかを検証して IDOR 経路を塞ぐ。
"""

from uuid import UUID

from src.application.unit_of_work import UnitOfWorkFactory
from src.common.models import FrozenModel
from src.domain.entities.user import User
from src.domain.services.speech_to_text_service import (
    AudioTooLargeError,
    SpeechToTextService,
    UnsupportedAudioFormatError,
)


class SessionNotFoundError(Exception):
    """指定された session_id が存在しないか、current_user の所有ではない。"""


class TranscribeAudioCommand(FrozenModel):
    """文字起こしリクエストの入力 DTO。"""

    session_id: UUID
    audio_bytes: bytes
    mime_type: str


class TranscribeAudioOutput(FrozenModel):
    """文字起こし結果の出力 DTO。"""

    transcript: str


class TranscribeAudio:
    """音声バイトを Cloud STT で文字起こしする UseCase。"""

    def __init__(
        self,
        *,
        unit_of_work_factory: UnitOfWorkFactory,
        speech_service: SpeechToTextService,
        max_bytes: int,
        allowed_mime_types: tuple[str, ...],
    ) -> None:
        self._unit_of_work_factory = unit_of_work_factory
        self._speech_service = speech_service
        self._max_bytes = max_bytes
        self._allowed_mime_types = tuple(mt.lower() for mt in allowed_mime_types)

    async def execute(
        self,
        current_user: User,
        command: TranscribeAudioCommand,
    ) -> TranscribeAudioOutput:
        # session 所有者検証 (IDOR 防止)。存在しない / 別ユーザーの session は
        # 区別せず NotFound 扱いにして、外部から id の存在を確認できないようにする。
        async with self._unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(command.session_id)
            if session is None or session.user_id != current_user.id:
                raise SessionNotFoundError("session not found")

        if len(command.audio_bytes) == 0:
            raise UnsupportedAudioFormatError("音声バイト列が空です。")
        if len(command.audio_bytes) > self._max_bytes:
            raise AudioTooLargeError(f"音声サイズが上限 {self._max_bytes} bytes を超えています。")
        if command.mime_type.lower() not in self._allowed_mime_types:
            raise UnsupportedAudioFormatError(
                f"サポートされていない音声 MIME type です: {command.mime_type}"
            )

        transcript = await self._speech_service.transcribe(
            audio_bytes=command.audio_bytes,
            mime_type=command.mime_type,
        )
        return TranscribeAudioOutput(transcript=transcript)

"""SubmitTextOutput / SubmitImageOutput の共通フローを抽出した基底。

両 UseCase の差分は (1) リクエスト前バリデーション (path 検証等)、
(2) Output エンティティの構築、(3) commit 後の副作用 (旧 GCS オブジェクト削除等)
の 3 点だけなので、その 3 つを hook として子で override する構造にしている。
"""

from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Generic, Protocol, TypeVar
from uuid import UUID, uuid4

from src.application.dto.session_dto import SubmitOutputView
from src.application.mappers.session_mapper import to_output_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.judgment_progress import JudgmentProgress
from src.domain.entities.output import Output
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class InvalidSessionStatusError(Exception):
    """アウトプット送信が許可されていないセッション状態。"""


class _SubmitOutputCommand(Protocol):
    """共通基底が要求する command の最小 protocol。

    実体は pydantic BaseModel で structural に互換していれば良い
    （明示継承は不要）。`session_id: UUID` `submitted_at: datetime` を持つこと。
    """

    session_id: UUID
    submitted_at: datetime


CommandT = TypeVar("CommandT", bound=_SubmitOutputCommand)


class SubmitOutputBase(ABC, Generic[CommandT]):
    """テキスト / 画像どちらの output 送信でも共通する保存・状態遷移を担う基底。"""

    def __init__(self, unit_of_work_factory: UnitOfWorkFactory) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(self, current_user: User, command: CommandT) -> SubmitOutputView:
        self._pre_validate(current_user, command)

        async with self.unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(command.session_id)
            if session is None or session.user_id != current_user.id:
                raise SessionNotFoundError("session not found")

            if not session.can_accept_output():
                raise InvalidSessionStatusError(
                    f"cannot submit output while session is {session.status.value}"
                )

            existing_output = await uow.outputs.find_by_session_id(session.id)
            output = self._build_output(
                command=command,
                session=session,
                existing_output=existing_output,
            )
            await uow.outputs.upsert(output)

            updated_status = session.status_after_output_submission()
            if updated_status is not session.status:
                updated_session = session.with_status(new_status=updated_status)
                await uow.sessions.update(updated_session)
            else:
                updated_session = session

            now = datetime.now(UTC)
            await uow.judgment_progresses.upsert(
                JudgmentProgress(
                    session_id=session.id,
                    status=JudgmentProgressStatus.QUEUED,
                    stage=JudgmentProgressStage.QUEUED,
                    percent=5,
                    message="判定をキューに登録しました。",
                    event_seq=1,
                    started_at=now,
                    updated_at=now,
                    completed_at=None,
                    error_code=None,
                )
            )

            await uow.commit()

        await self._after_commit(command=command, existing_output=existing_output)

        return SubmitOutputView(
            output=to_output_view(output),
            status=updated_session.status,
        )

    def _pre_validate(self, current_user: User, command: CommandT) -> None:
        """commit 前のリクエスト検証。子で override できる (デフォルト no-op)。

        例: 画像 path のユーザー所有検証はここで行う。例外を投げると 4xx に
        マップされる前提。
        """

    @abstractmethod
    def _build_output(
        self,
        *,
        command: CommandT,
        session: Session,
        existing_output: Output | None,
    ) -> Output:
        """command から保存対象の Output を構築する。子で必須実装。"""

    async def _after_commit(
        self,
        *,
        command: CommandT,
        existing_output: Output | None,
    ) -> None:
        """commit 後の副作用フック。子で override できる (デフォルト no-op)。

        例: 旧画像オブジェクトの削除はここで行う。失敗してもアプリ動作を
        止めない場合は子側で握りつぶすこと。
        """


def _next_output_id(existing_output: Output | None) -> UUID:
    """既存 output があればその id を、無ければ新規 uuid を返すヘルパ。"""
    return existing_output.id if existing_output is not None else uuid4()

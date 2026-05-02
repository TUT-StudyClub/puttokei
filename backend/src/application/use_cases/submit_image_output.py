"""画像アウトプット送信のユースケース。"""

import logging
from datetime import UTC, datetime
from uuid import uuid4

from src.application.dto.session_dto import SubmitImageOutputCommand, SubmitOutputView
from src.application.mappers.session_mapper import to_output_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.judgment_progress import JudgmentProgress
from src.domain.entities.output import Output
from src.domain.entities.user import User
from src.domain.services.output_image_storage import OutputImageStorage
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.domain.value_objects.output_kind import OutputKind

logger = logging.getLogger(__name__)


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class InvalidSessionStatusError(Exception):
    """アウトプット送信が許可されていないセッション状態。"""


class InvalidStoragePathError(Exception):
    """送信されてきた image_storage_path が当該ユーザー所有の prefix を満たさない。

    本来 IssueOutputImageUploadUrl で発行された path だけを受け付けるが、
    クライアントが任意の文字列を送りつけて他ユーザーの画像を流用しないよう、
    `outputs/{user_id}/` プレフィックスを強制することで IDOR 類似の攻撃を防ぐ。
    """


class SubmitImageOutput:
    """画像アウトプット (GCS path) を保存し、セッションを judging に進める。"""

    def __init__(
        self,
        unit_of_work_factory: UnitOfWorkFactory,
        image_storage: OutputImageStorage | None = None,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory
        # `image_storage` は上書き提出時の旧 GCS オブジェクト削除に使う。
        # GCS 設定が無い環境（local dev で画像機能を使わない場合）では None でも動く。
        self.image_storage = image_storage

    async def execute(
        self,
        current_user: User,
        command: SubmitImageOutputCommand,
    ) -> SubmitOutputView:
        expected_prefix = f"outputs/{current_user.id}/"
        if not command.image_storage_path.startswith(expected_prefix):
            raise InvalidStoragePathError(f"image_storage_path must start with {expected_prefix}")
        # `..` を含む path traversal も明示的に拒否（GCS は通常解釈しないが念のため）。
        if ".." in command.image_storage_path.split("/"):
            raise InvalidStoragePathError("image_storage_path must not contain '..'")

        async with self.unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(command.session_id)
            if session is None or session.user_id != current_user.id:
                raise SessionNotFoundError("session not found")

            if not session.can_accept_output():
                raise InvalidSessionStatusError(
                    f"cannot submit output while session is {session.status.value}"
                )

            existing_output = await uow.outputs.find_by_session_id(session.id)
            output = Output(
                id=existing_output.id if existing_output is not None else uuid4(),
                session_id=session.id,
                kind=OutputKind.IMAGE,
                content=None,
                image_storage_path=command.image_storage_path,
                submitted_at=command.submitted_at,
            )
            await uow.outputs.upsert(output)

            # 上書き提出で旧 GCS オブジェクトが孤立する場合は best-effort で削除。
            # 削除失敗してもアプリの判定フローは止めず、lifecycle (7 日) に任せる。
            stale_storage_path: str | None = None
            if (
                existing_output is not None
                and existing_output.kind is OutputKind.IMAGE
                and existing_output.image_storage_path is not None
                and existing_output.image_storage_path != command.image_storage_path
            ):
                stale_storage_path = existing_output.image_storage_path

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

        if stale_storage_path is not None and self.image_storage is not None:
            try:
                await self.image_storage.delete(storage_path=stale_storage_path)
            except Exception:
                # GCS のクリーンアップ失敗は止めない (lifecycle 7 日でフォールバック)。
                logger.warning(
                    "failed to delete stale image storage_path=%s",
                    stale_storage_path,
                    exc_info=True,
                )

        return SubmitOutputView(
            output=to_output_view(output),
            status=updated_session.status,
        )

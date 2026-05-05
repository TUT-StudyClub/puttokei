"""画像アウトプット送信のユースケース。"""

import logging

from src.application.dto.session_dto import SubmitImageOutputCommand
from src.application.unit_of_work import UnitOfWorkFactory
from src.application.use_cases._submit_output_base import (
    InvalidSessionStatusError,
    SessionNotFoundError,
    SubmitOutputBase,
    _next_output_id,
)
from src.domain.entities.output import Output
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.services.output_image_storage import OutputImageStorage
from src.domain.value_objects.output_kind import OutputKind

__all__ = [
    "InvalidSessionStatusError",
    "InvalidStoragePathError",
    "SessionNotFoundError",
    "SubmitImageOutput",
]

logger = logging.getLogger(__name__)


class InvalidStoragePathError(Exception):
    """送信されてきた image_storage_path が当該ユーザー所有の prefix を満たさない。

    本来 IssueOutputImageUploadUrl で発行された path だけを受け付けるが、
    クライアントが任意の文字列を送りつけて他ユーザーの画像を流用しないよう、
    `outputs/{user_id}/` プレフィックスを強制することで IDOR 類似の攻撃を防ぐ。
    """


class SubmitImageOutput(SubmitOutputBase[SubmitImageOutputCommand]):
    """画像アウトプット (GCS path) を保存し、セッションを judging に進める。"""

    def __init__(
        self,
        unit_of_work_factory: UnitOfWorkFactory,
        image_storage: OutputImageStorage | None = None,
    ) -> None:
        super().__init__(unit_of_work_factory)
        # `image_storage` は上書き提出時の旧 GCS オブジェクト削除に使う。
        # GCS 設定が無い環境（local dev で画像機能を使わない場合）では None でも動く。
        self.image_storage = image_storage

    def _pre_validate(self, current_user: User, command: SubmitImageOutputCommand) -> None:
        expected_prefix = f"outputs/{current_user.id}/"
        if not command.image_storage_path.startswith(expected_prefix):
            raise InvalidStoragePathError(f"image_storage_path must start with {expected_prefix}")
        # `..` を含む path traversal も明示的に拒否（GCS は通常解釈しないが念のため）。
        if ".." in command.image_storage_path.split("/"):
            raise InvalidStoragePathError("image_storage_path must not contain '..'")

    def _build_output(
        self,
        *,
        command: SubmitImageOutputCommand,
        session: Session,
        existing_output: Output | None,
    ) -> Output:
        return Output(
            id=_next_output_id(existing_output),
            session_id=session.id,
            kind=OutputKind.IMAGE,
            content=None,
            image_storage_path=command.image_storage_path,
            submitted_at=command.submitted_at,
        )

    async def _after_commit(
        self,
        *,
        command: SubmitImageOutputCommand,
        existing_output: Output | None,
    ) -> None:
        # 上書き提出で旧 GCS オブジェクトが孤立する場合は best-effort で削除。
        # 削除失敗してもアプリの判定フローは止めず、lifecycle (7 日) に任せる。
        if (
            existing_output is None
            or existing_output.kind is not OutputKind.IMAGE
            or existing_output.image_storage_path is None
            or existing_output.image_storage_path == command.image_storage_path
        ):
            return
        if self.image_storage is None:
            return
        stale_path = existing_output.image_storage_path
        try:
            await self.image_storage.delete(storage_path=stale_path)
        except Exception:
            # GCS のクリーンアップ失敗は止めない (lifecycle 7 日でフォールバック)。
            logger.warning(
                "failed to delete stale image storage_path=%s",
                stale_path,
                exc_info=True,
            )

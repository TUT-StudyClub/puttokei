"""アウトプット画像のアップロード URL 発行ユースケース。"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from src.application.dto.session_dto import (
    IssueOutputImageUploadUrlCommand,
    IssueOutputImageUploadUrlView,
)
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User
from src.domain.services.output_image_storage import OutputImageStorage


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class InvalidSessionStatusError(Exception):
    """画像アップロードが許可されていないセッション状態。"""


class UnsupportedMimeTypeError(Exception):
    """許可されていない MIME type が指定された。"""


class IssueOutputImageUploadUrl:
    """画像アウトプット用に GCS への直接アップロード URL を発行する。

    画像 path は `outputs/{userId}/{uuid}.{ext}` 形式で採番し、
    成功した URL とともに返す。クライアントはこの URL に PUT で画像を送り、
    別途 `POST /sessions/{id}/outputs/image` に storage_path を渡す。
    """

    def __init__(
        self,
        *,
        unit_of_work_factory: UnitOfWorkFactory,
        storage: OutputImageStorage,
        allowed_mime_types: tuple[str, ...],
        upload_url_ttl_seconds: int,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory
        self.storage = storage
        self.allowed_mime_types = allowed_mime_types
        self.upload_url_ttl_seconds = upload_url_ttl_seconds

    async def execute(
        self,
        current_user: User,
        command: IssueOutputImageUploadUrlCommand,
    ) -> IssueOutputImageUploadUrlView:
        if command.mime_type not in self.allowed_mime_types:
            raise UnsupportedMimeTypeError(
                f"mime type {command.mime_type} is not allowed"
            )

        async with self.unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(command.session_id)
            if session is None or session.user_id != current_user.id:
                raise SessionNotFoundError("session not found")
            if not session.can_accept_output():
                raise InvalidSessionStatusError(
                    f"cannot upload output image while session is {session.status.value}"
                )

        extension = _extension_for_mime(command.mime_type)
        storage_path = f"outputs/{current_user.id}/{uuid4()}.{extension}"
        upload_url = self.storage.issue_upload_url(
            storage_path=storage_path,
            content_type=command.mime_type,
            ttl_seconds=self.upload_url_ttl_seconds,
        )
        expires_at = datetime.now(UTC) + timedelta(seconds=self.upload_url_ttl_seconds)
        return IssueOutputImageUploadUrlView(
            upload_url=upload_url,
            storage_path=storage_path,
            expires_at=expires_at,
        )


def _extension_for_mime(mime_type: str) -> str:
    if mime_type == "image/jpeg":
        return "jpg"
    if mime_type == "image/png":
        return "png"
    return "bin"

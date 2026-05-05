"""Output エンティティ。セッションごとに 1 件のアウトプット本文。"""

from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import model_validator

from src.common.models import FrozenModel
from src.domain.value_objects.output_kind import OutputKind


class Output(FrozenModel):
    """送信されたアウトプット本文を表現するエンティティ。

    `kind` がテキストなら `content` を持ち、画像なら `image_storage_path` を持つ。
    両者は排他で、片方は必ず存在し、もう片方は None でなければならない。
    """

    id: UUID
    session_id: UUID
    kind: OutputKind
    content: str | None
    image_storage_path: str | None
    submitted_at: datetime

    @model_validator(mode="after")
    def _validate_kind_payload(self) -> Self:
        if self.kind is OutputKind.TEXT:
            if self.content is None:
                raise ValueError("text output requires content")
            if self.image_storage_path is not None:
                raise ValueError("text output must not have image_storage_path")
        elif self.kind is OutputKind.IMAGE:
            if self.image_storage_path is None:
                raise ValueError("image output requires image_storage_path")
            if self.content is not None:
                raise ValueError("image output must not have content")
        return self

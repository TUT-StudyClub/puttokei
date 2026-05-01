"""outputs テーブルの SQLAlchemy モデル。"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.models.base import Base


class OutputModel(Base):
    """1 セッション 1 件のアウトプット本文。"""

    __tablename__ = "outputs"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    session_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(length=16), nullable=False)
    content: Mapped[str | None] = mapped_column(Text(), nullable=True)
    image_storage_path: Mapped[str | None] = mapped_column(Text(), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

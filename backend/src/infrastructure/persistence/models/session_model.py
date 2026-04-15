"""sessions テーブルの SQLAlchemy モデル。要件書 4.3.3 に対応。"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.models.base import Base


class SessionModel(Base):
    """学習 1 サイクルを表す sessions レコード。"""

    __tablename__ = "sessions"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    subject: Mapped[str] = mapped_column(String(50), nullable=False)
    topic: Mapped[str] = mapped_column(String(200), nullable=False)
    input_minutes: Mapped[int] = mapped_column(Integer(), nullable=False)
    output_minutes: Mapped[int] = mapped_column(Integer(), nullable=False)
    break_minutes: Mapped[int] = mapped_column(Integer(), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

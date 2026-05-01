"""judgment_progresses テーブルの SQLAlchemy モデル。"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.models.base import Base


class JudgmentProgressModel(Base):
    """セッションごとの LLM 判定進捗。"""

    __tablename__ = "judgment_progresses"

    session_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    stage: Mapped[str] = mapped_column(String(32), nullable=False)
    percent: Mapped[int] = mapped_column(Integer(), nullable=False)
    message: Mapped[str] = mapped_column(String(200), nullable=False)
    event_seq: Mapped[int] = mapped_column(Integer(), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

"""judgments テーブルの SQLAlchemy モデル。"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.models.base import Base


class JudgmentModel(Base):
    """セッションごとの判定結果。"""

    __tablename__ = "judgments"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    session_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    verdict: Mapped[str] = mapped_column(String(16), nullable=False)
    score: Mapped[int] = mapped_column(Integer(), nullable=False)
    advice: Mapped[str] = mapped_column(Text(), nullable=False)
    corrections: Mapped[list[dict[str, str]]] = mapped_column(JSONB(), nullable=False)
    judged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

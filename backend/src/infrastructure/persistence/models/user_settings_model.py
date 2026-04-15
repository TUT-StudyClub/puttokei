"""user_settings テーブルの SQLAlchemy モデル。要件書 4.3.2 に対応。"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.models.base import Base


class UserSettingsModel(Base):
    """ユーザごとのタイマー / 通知設定。"""

    __tablename__ = "user_settings"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    input_minutes: Mapped[int] = mapped_column(nullable=False, server_default="20", default=20)
    output_minutes: Mapped[int] = mapped_column(nullable=False, server_default="5", default=5)
    break_minutes: Mapped[int] = mapped_column(nullable=False, server_default="5", default=5)
    notification_enabled: Mapped[bool] = mapped_column(
        nullable=False, server_default="true", default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

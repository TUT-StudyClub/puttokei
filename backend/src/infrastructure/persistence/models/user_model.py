"""users テーブルの SQLAlchemy モデル。要件書 4.3.1 + age_group / onboarding_completed を持つ。"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.models.base import Base


class UserModel(Base):
    """users テーブル。Firebase UID と紐づく内部ユーザ。"""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(16), nullable=False)
    age_group: Mapped[str | None] = mapped_column(String(16), nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(
        nullable=False, server_default="false", default=False
    )
    fcm_token: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

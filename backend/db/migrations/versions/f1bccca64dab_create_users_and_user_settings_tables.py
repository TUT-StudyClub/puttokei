"""create users and user settings tables

Revision ID: f1bccca64dab
Revises:
Create Date: 2026-04-15 08:56:35.582630

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1bccca64dab"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("firebase_uid", sa.String(length=128), nullable=False),
        sa.Column("display_name", sa.String(length=64), nullable=True),
        sa.Column("auth_provider", sa.String(length=16), nullable=False),
        sa.Column("age_group", sa.String(length=16), nullable=True),
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("fcm_token", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("firebase_uid", name="uq_users_firebase_uid"),
    )

    op.create_table(
        "user_settings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "input_minutes",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("20"),
        ),
        sa.Column(
            "output_minutes",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("5"),
        ),
        sa.Column(
            "break_minutes",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("5"),
        ),
        sa.Column(
            "notification_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_settings_user_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("user_id", name="uq_user_settings_user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_settings")
    op.drop_table("users")

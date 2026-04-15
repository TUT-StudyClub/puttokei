"""create sessions table

Revision ID: a47617ee9c12
Revises: f1bccca64dab
Create Date: 2026-04-15 16:48:51.353234

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a47617ee9c12"
down_revision: str | None = "f1bccca64dab"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("subject", sa.String(length=50), nullable=False),
        sa.Column("topic", sa.String(length=200), nullable=False),
        sa.Column("input_minutes", sa.Integer(), nullable=False),
        sa.Column("output_minutes", sa.Integer(), nullable=False),
        sa.Column("break_minutes", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_sessions_user_id",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index(
        "ix_sessions_user_id_started_at",
        "sessions",
        ["user_id", sa.text("started_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_sessions_user_id_started_at", table_name="sessions")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_table("sessions")

"""create judgment_progresses table

Revision ID: c7e5d9a13f42
Revises: b3a21f4c8e15
Create Date: 2026-05-01 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7e5d9a13f42"
down_revision: str | None = "b3a21f4c8e15"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "judgment_progresses",
        sa.Column("session_id", sa.Uuid(), primary_key=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("stage", sa.String(length=32), nullable=False),
        sa.Column("percent", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(length=200), nullable=False),
        sa.Column("event_seq", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"],
            name="fk_judgment_progresses_session_id",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_judgment_progresses_status",
        "judgment_progresses",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_judgment_progresses_status", table_name="judgment_progresses")
    op.drop_table("judgment_progresses")

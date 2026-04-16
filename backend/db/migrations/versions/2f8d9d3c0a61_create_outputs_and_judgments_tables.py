"""create outputs and judgments tables

Revision ID: 2f8d9d3c0a61
Revises: a47617ee9c12
Create Date: 2026-04-16 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "2f8d9d3c0a61"
down_revision: str | None = "a47617ee9c12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "outputs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"],
            name="fk_outputs_session_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("session_id", name="uq_outputs_session_id"),
    )
    op.create_index("ix_outputs_session_id", "outputs", ["session_id"])

    op.create_table(
        "judgments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("verdict", sa.String(length=16), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("advice", sa.Text(), nullable=False),
        sa.Column(
            "items",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("judged_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.id"],
            name="fk_judgments_session_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("session_id", name="uq_judgments_session_id"),
    )
    op.create_index("ix_judgments_session_id", "judgments", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_judgments_session_id", table_name="judgments")
    op.drop_table("judgments")
    op.drop_index("ix_outputs_session_id", table_name="outputs")
    op.drop_table("outputs")

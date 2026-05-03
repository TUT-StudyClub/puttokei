"""create output subject assignments

Revision ID: 9a1f2c3d4e5f
Revises: d8b4f1e29a3c
Create Date: 2026-05-03 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9a1f2c3d4e5f"
down_revision: str | None = "d8b4f1e29a3c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_subjects",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False),
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
            name="fk_user_subjects_user_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("user_id", "label", name="uq_user_subjects_user_id_label"),
    )
    op.create_index("ix_user_subjects_user_id", "user_subjects", ["user_id"])

    op.create_table(
        "output_subject_assignments",
        sa.Column("output_id", sa.Uuid(), primary_key=True),
        sa.Column("subject_id", sa.Uuid(), nullable=False),
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
            ["output_id"],
            ["outputs.id"],
            name="fk_output_subject_assignments_output_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["user_subjects.id"],
            name="fk_output_subject_assignments_subject_id",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_output_subject_assignments_subject_id",
        "output_subject_assignments",
        ["subject_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_output_subject_assignments_subject_id",
        table_name="output_subject_assignments",
    )
    op.drop_table("output_subject_assignments")
    op.drop_index("ix_user_subjects_user_id", table_name="user_subjects")
    op.drop_table("user_subjects")

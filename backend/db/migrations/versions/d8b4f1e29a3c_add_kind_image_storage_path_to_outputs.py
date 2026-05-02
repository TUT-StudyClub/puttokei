"""add kind and image_storage_path to outputs

Revision ID: d8b4f1e29a3c
Revises: c7e5d9a13f42
Create Date: 2026-05-01 13:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8b4f1e29a3c"
down_revision: str | None = "c7e5d9a13f42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "outputs",
        sa.Column(
            "kind",
            sa.String(length=16),
            nullable=False,
            server_default="text",
        ),
    )
    op.add_column(
        "outputs",
        sa.Column("image_storage_path", sa.Text(), nullable=True),
    )
    op.alter_column("outputs", "content", existing_type=sa.Text(), nullable=True)
    op.alter_column("outputs", "kind", server_default=None)
    op.create_check_constraint(
        "ck_outputs_kind_payload",
        "outputs",
        "(kind = 'text' AND content IS NOT NULL AND image_storage_path IS NULL) "
        "OR (kind = 'image' AND content IS NULL AND image_storage_path IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_outputs_kind_payload", "outputs", type_="check")
    # 旧スキーマは画像アウトプットを表現できない (content NOT NULL, kind/image_storage_path 列なし)。
    # content を NOT NULL に戻す前に、image アウトプット行を削除してから列を落とす。
    # 復元したい場合は事前にバックアップを取ってから downgrade すること。
    op.execute(sa.text("DELETE FROM outputs WHERE kind = 'image'"))
    op.alter_column("outputs", "content", existing_type=sa.Text(), nullable=False)
    op.drop_column("outputs", "image_storage_path")
    op.drop_column("outputs", "kind")

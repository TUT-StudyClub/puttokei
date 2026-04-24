"""rename judgments.items to corrections

Revision ID: b3a21f4c8e15
Revises: 2f8d9d3c0a61
Create Date: 2026-04-23 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3a21f4c8e15"
down_revision: str | None = "2f8d9d3c0a61"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # items 配列の内部構造 ({label, comment}) から corrections 配列の構造
    # ({target_text, correct_text, explanation}) に変更するため、
    # 既存の判定レコードは維持できない。カラム名変更前にデータを消去する。
    op.execute("DELETE FROM judgments")
    op.alter_column("judgments", "items", new_column_name="corrections")


def downgrade() -> None:
    op.execute("DELETE FROM judgments")
    op.alter_column("judgments", "corrections", new_column_name="items")

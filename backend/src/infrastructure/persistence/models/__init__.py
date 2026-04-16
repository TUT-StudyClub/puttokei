"""SQLAlchemy ORM モデルを集約するパッケージ。

`Base` を一箇所に集め、Alembic の `target_metadata` で全モデルをまとめて扱えるようにする。
個別モデルは side-effect import により metadata に登録される。
"""

from src.infrastructure.persistence.models.base import Base
from src.infrastructure.persistence.models.judgment_model import JudgmentModel
from src.infrastructure.persistence.models.output_model import OutputModel
from src.infrastructure.persistence.models.session_model import SessionModel
from src.infrastructure.persistence.models.user_model import UserModel
from src.infrastructure.persistence.models.user_settings_model import UserSettingsModel

__all__ = [
    "Base",
    "JudgmentModel",
    "OutputModel",
    "SessionModel",
    "UserModel",
    "UserSettingsModel",
]

"""SQLAlchemy ORM モデルを集約するパッケージ。

`Base` を一箇所に集め、Alembic の `target_metadata` で全モデルをまとめて扱えるようにする。
個別モデルは side-effect import により metadata に登録される。
"""

from src.infrastructure.persistence.models.base import Base
from src.infrastructure.persistence.models.user_model import UserModel
from src.infrastructure.persistence.models.user_settings_model import UserSettingsModel

__all__ = ["Base", "UserModel", "UserSettingsModel"]

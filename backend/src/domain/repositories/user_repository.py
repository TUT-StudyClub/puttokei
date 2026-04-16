"""User リポジトリの抽象 IF。

具体実装は `infrastructure/persistence/repositories/pg_user_repository.py`。
"""

from abc import ABC, abstractmethod
from uuid import UUID

from src.domain.entities.user import User
from src.domain.entities.user_settings import UserSettings


class UserAlreadyExistsError(Exception):
    """firebase_uid が既存行と衝突した場合に送出される。

    論理削除済みのユーザが残っている状態で、同じ firebase_uid で新規作成しようと
    したときに発生する。保護 API では 401 として扱い、アカウントの再利用を防ぐ。
    """


class UserRepository(ABC):
    """User の永続化に対する抽象 IF。"""

    @abstractmethod
    async def find_by_firebase_uid(self, firebase_uid: str) -> User | None:
        """Firebase UID から「生きている」内部ユーザを取得する。

        論理削除済み（deleted_at が設定済み）のユーザは None として扱う。未登録時
        も None。auth_middleware が未登録判定にそのまま使う前提で、削除済みを返さ
        ないことでアカウントの再利用を防ぐ。
        """

    @abstractmethod
    async def add(self, user: User, settings: UserSettings) -> None:
        """新規ユーザと初期設定を同一トランザクションで保存する。

        同じ firebase_uid の行（論理削除済みを含む）が既に存在する場合は
        `UserAlreadyExistsError` を送出する。
        """

    @abstractmethod
    async def update(self, user: User) -> None:
        """既存ユーザのプロフィールを更新する。論理削除（deleted_at セット）もここで行う。"""

    @abstractmethod
    async def find_settings_by_user_id(self, user_id: UUID) -> UserSettings | None:
        """ユーザ ID から user_settings を取得する。未登録時は None。"""

    @abstractmethod
    async def update_settings(self, settings: UserSettings) -> None:
        """user_settings を更新する。user_id で対象を特定する前提。"""

    @abstractmethod
    async def delete_by_id(self, user_id: UUID) -> None:
        """ユーザを物理削除する（30 日後バッチ用、Issue #61）。

        通常のアカウント削除（DELETE /users/me）は `update` 経由での論理削除
        （deleted_at セット）を使う。本メソッドは論理削除から 30 日経過したレコードを
        GC する定期ジョブ専用で、FK ondelete=CASCADE により user_settings / sessions
        / outputs / judgments も連鎖削除される。
        """

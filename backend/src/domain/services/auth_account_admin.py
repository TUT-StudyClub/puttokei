"""外部認証プロバイダー上のユーザ管理サービス IF。

退会フローでは backend DB と外部認証側のユーザを両方削除する必要があるため、
DB 永続化とは独立した IF として切り出す。具体実装は
`infrastructure/auth/firebase_auth_account_admin.py` にあり、Composition Root で
組み立てる。Application 層は本インタフェース経由でのみ削除処理を呼ぶ。
"""

from abc import ABC, abstractmethod


class AuthAccountNotFoundError(Exception):
    """対象 uid が外部認証プロバイダー側に存在しなかった。

    既に削除済みのアカウントを再削除するケースなどで発生する。退会 UseCase は
    本例外を idempotent に握り潰し、DB 削除を続行する。
    """


class AuthAccountAdmin(ABC):
    """外部認証プロバイダー上のユーザを管理するサービス。"""

    @abstractmethod
    async def delete_user(self, uid: str) -> None:
        """指定 uid のユーザを削除する。

        対象が既に存在しない場合は AuthAccountNotFoundError を送出する。
        それ以外のエラー（ネットワーク / 認証情報不備 等）は原例外をそのまま伝播し、
        呼び出し元（退会 UseCase）で DB 削除をスキップして処理を中断させる。
        """

"""学習セッションのライフサイクルを表現するステータス。"""

from enum import Enum


class SessionStatus(str, Enum):
    """セッションの遷移ステータス。"""

    INPUT = "input"
    OUTPUT = "output"
    JUDGING = "judging"
    JUDGED = "judged"
    CANCELLED = "cancelled"

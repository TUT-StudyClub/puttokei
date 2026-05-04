"""統計 API の期間種別。"""

from enum import Enum


class StatsPeriod(str, Enum):
    """統計点をまとめる期間単位。"""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

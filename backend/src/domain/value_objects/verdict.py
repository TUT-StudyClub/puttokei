"""LLM 判定の結果区分。"""

from enum import Enum


class Verdict(str, Enum):
    """LLM 判定結果の Verdict。"""

    CORRECT = "correct"
    PARTIAL = "partial"
    INCORRECT = "incorrect"
    REJECTED = "rejected"

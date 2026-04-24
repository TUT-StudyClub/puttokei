"""Judgment エンティティ。LLM 判定の結果。"""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from src.common.models import FrozenModel
from src.domain.value_objects.verdict import Verdict


class JudgmentCorrection(FrozenModel):
    """アウトプット中の誤りに対する指摘。

    - target_text: ユーザーのアウトプット中で誤っていると判定された部分。
      モバイル UI では赤色ハイライトの対象となる。
    - correct_text: 正解。target_text を正しくした文または語句。
    - explanation: 誤りの理由と正しい内容の解説。
    """

    target_text: str
    correct_text: str
    explanation: str


class Judgment(FrozenModel):
    """判定結果を表現するエンティティ。"""

    id: UUID
    session_id: UUID
    verdict: Verdict
    score: int = Field(ge=0, le=100)
    advice: str
    corrections: list[JudgmentCorrection]
    judged_at: datetime

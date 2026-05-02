"""Judgment エンティティ。LLM 判定の結果。"""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from src.common.models import FrozenModel
from src.domain.value_objects.judgment_result import BoundingBox
from src.domain.value_objects.verdict import Verdict


class JudgmentCorrection(FrozenModel):
    """アウトプット中の誤りに対する指摘。

    - target_text: ユーザーのアウトプット中で誤っていると判定された部分。
      モバイル UI では赤色ハイライト（テキスト時は文字列ハイライト、
      画像時は bbox に基づく赤下線オーバーレイ）の対象となる。
    - correct_text: 正解。target_text を正しくした文または語句。
    - explanation: 誤りの理由と正しい内容の解説。
    - bbox: 画像判定時の位置情報（0〜1 正規化座標）。テキスト判定や
      位置特定不可の場合は None。
    """

    target_text: str
    correct_text: str
    explanation: str
    bbox: BoundingBox | None = None


class Judgment(FrozenModel):
    """判定結果を表現するエンティティ。"""

    id: UUID
    session_id: UUID
    verdict: Verdict
    score: int = Field(ge=0, le=100)
    advice: str
    corrections: list[JudgmentCorrection]
    judged_at: datetime

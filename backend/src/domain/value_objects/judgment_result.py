"""LLM 判定の生の結果値オブジェクト。永続化前の中間表現。

`infrastructure/llm/*_provider.py` の戻り値、`Judgment` エンティティ生成の入力に使う。
"""

from pydantic import BaseModel, ConfigDict, Field

from src.domain.value_objects.verdict import Verdict


class JudgmentCorrection(BaseModel):
    """アウトプット中の誤りに対する指摘の 1 件。"""

    model_config = ConfigDict(frozen=True)

    target_text: str
    correct_text: str
    explanation: str


class JudgmentResult(BaseModel):
    """LLM 判定の生の結果。verdict / score / advice / 誤り指摘を保持する。"""

    model_config = ConfigDict(frozen=True)

    verdict: Verdict
    score: int = Field(ge=0, le=100)
    advice: str
    corrections: list[JudgmentCorrection]

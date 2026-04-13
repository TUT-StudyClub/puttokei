"""LLM 判定の生の結果値オブジェクト。永続化前の中間表現。

`infrastructure/llm/*_provider.py` の戻り値、`Judgment` エンティティ生成の入力に使う。
"""

from pydantic import BaseModel, ConfigDict, Field

from src.domain.value_objects.verdict import Verdict


class JudgmentItem(BaseModel):
    """項目別フィードバックの 1 件。"""

    model_config = ConfigDict(frozen=True)

    label: str
    comment: str


class JudgmentResult(BaseModel):
    """LLM 判定の生の結果。verdict / score / advice / 項目別フィードバックを保持する。"""

    model_config = ConfigDict(frozen=True)

    verdict: Verdict
    score: int = Field(ge=0, le=100)
    advice: str
    items: list[JudgmentItem]

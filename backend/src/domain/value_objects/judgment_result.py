"""LLM 判定の生の結果値オブジェクト。永続化前の中間表現。

`infrastructure/llm/*_provider.py` の戻り値、`Judgment` エンティティ生成の入力に使う。
"""

from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.domain.value_objects.verdict import Verdict


class BoundingBox(BaseModel):
    """画像内の領域を 0〜1 正規化座標で表す。

    Gemini が稀に境界外の値（例: -0.001 / 1.05）を返してくることがあるため、
    厳密な範囲チェックではなく clamp で 0〜1 に丸めて受け入れる。判定全体を
    LLM の小さな出力ブレで失敗させないための寛容化。
    """

    model_config = ConfigDict(frozen=True)

    x: float
    y: float
    width: float
    height: float

    @field_validator("x", "y", "width", "height", mode="before")
    @classmethod
    def _clamp_to_unit_range(cls, value: object) -> float:
        if not isinstance(value, int | float):
            raise TypeError(f"bbox coordinate must be numeric, got {type(value).__name__}")
        return max(0.0, min(1.0, float(value)))

    @model_validator(mode="after")
    def _ensure_within_image(self) -> Self:
        # x + width / y + height が 1 を超えないように右下端を画像内に押し込む。
        # width / height 自体は既に 0〜1 にクランプ済みなのでマイナスにはならない。
        if self.x + self.width > 1.0:
            object.__setattr__(self, "width", max(0.0, 1.0 - self.x))
        if self.y + self.height > 1.0:
            object.__setattr__(self, "height", max(0.0, 1.0 - self.y))
        return self


class JudgmentCorrection(BaseModel):
    """アウトプット中の誤りに対する指摘の 1 件。"""

    model_config = ConfigDict(frozen=True)

    target_text: str
    correct_text: str
    explanation: str
    bbox: BoundingBox | None = None


class JudgmentResult(BaseModel):
    """LLM 判定の生の結果。verdict / score / advice / 誤り指摘を保持する。"""

    model_config = ConfigDict(frozen=True)

    verdict: Verdict
    score: int = Field(ge=0, le=100)
    advice: str
    corrections: list[JudgmentCorrection]

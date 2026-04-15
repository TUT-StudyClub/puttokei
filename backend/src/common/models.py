"""pydantic BaseModel の共通基底。

各 layer の entity / DTO / schema で `ConfigDict(frozen=True)` が繰り返されるのを
避け、immutability を一箇所で宣言するための基底クラスを提供する。
"""

from pydantic import BaseModel, ConfigDict


class FrozenModel(BaseModel):
    """値が書き換えられない immutable な BaseModel の共通基底。

    Pydantic の `frozen=True` は setattr を禁止するだけで、
    複製（`model_copy`）や派生（継承）は妨げない。
    """

    model_config = ConfigDict(frozen=True)


class StrictRequestModel(BaseModel):
    """HTTP リクエスト向けの厳格な BaseModel 基底。

    - `frozen=True`: 入力を不変にする
    - `extra="forbid"`: 未知フィールドが含まれていたら 422 で蹴る
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

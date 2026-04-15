"""ユーザの年齢区分を表す値オブジェクト。

要件書 5.1 の「ユーザ登録の際の年齢を反映させる」に対応する区分。
個人情報を最小化するため生年月日ではなく粗い区分で保持する。
"""

from enum import Enum


class AgeGroup(str, Enum):
    """年齢区分。未設定時は User.age_group=None とし、本 enum には含めない。"""

    TEEN = "teen"
    TWENTIES = "20s"
    THIRTIES = "30s"
    FORTIES = "40s"
    FIFTIES = "50s"
    SIXTIES_PLUS = "60s_plus"

"""アウトプット本文の種別。"""

from enum import Enum


class OutputKind(str, Enum):
    """アウトプットがテキストか画像かを示す。"""

    TEXT = "text"
    IMAGE = "image"

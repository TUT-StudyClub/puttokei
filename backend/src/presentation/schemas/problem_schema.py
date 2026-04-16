"""RFC 7807 Problem Details の共通スキーマ。"""

from collections.abc import Sequence
from typing import Any

from src.common.models import FrozenModel


class ProblemDetails(FrozenModel):
    """HTTP エラーを統一表現する Problem Details。"""

    type: str
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
    errors: Sequence[Any] | None = None

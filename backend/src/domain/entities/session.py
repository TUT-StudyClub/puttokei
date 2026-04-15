"""Session エンティティ。学習 1 サイクル（input/output/break/result）。

要件書 4.3.3 と Issue #13 の方針に従い、subject / topic とユーザ毎のタイマー設定を
セッション単位で保持する。タイマー設定はユーザ設定（user_settings）の値で初期化された
うえで、開始時にカスタム値で上書きされる場合があるため、セッション側にも実値を持つ。
"""

from datetime import datetime
from uuid import UUID

from src.common.models import FrozenModel
from src.domain.value_objects.session_status import SessionStatus


class Session(FrozenModel):
    """学習 1 サイクルを表現するエンティティ。"""

    id: UUID
    user_id: UUID
    status: SessionStatus
    subject: str
    topic: str
    input_minutes: int
    output_minutes: int
    break_minutes: int
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime

"""判定履歴一覧のユースケース。"""

import base64
import binascii
import json
from datetime import datetime
from uuid import UUID

from src.application.dto.judgment_dto import JudgmentListView, ListJudgmentsQuery
from src.application.mappers.judgment_mapper import to_judgment_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User
from src.domain.value_objects.judgment_query import JudgmentListCursor, JudgmentSort

DEFAULT_JUDGMENT_LIST_LIMIT = 20
MAX_JUDGMENT_LIST_LIMIT = 100
_CURSOR_VERSION = 1


class InvalidJudgmentCursorError(Exception):
    """判定履歴一覧の cursor が不正。"""


class InvalidJudgmentListFilterError(Exception):
    """判定履歴一覧の検索条件が不正。"""


class ListJudgments:
    """ログインユーザーの判定履歴を一覧取得する。"""

    def __init__(
        self,
        *,
        unit_of_work_factory: UnitOfWorkFactory,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(
        self,
        current_user: User,
        query: ListJudgmentsQuery,
    ) -> JudgmentListView:
        _validate_query(query)
        cursor = _decode_cursor(query.cursor, sort=query.sort)

        async with self.unit_of_work_factory() as uow:
            judgments, next_cursor = await uow.judgments.list_by_user(
                user_id=current_user.id,
                cursor=cursor,
                limit=query.limit,
                verdict=query.verdict,
                judged_from=query.judged_from,
                judged_to=query.judged_to,
                sort=query.sort,
            )

        return JudgmentListView(
            judgments=[to_judgment_view(judgment) for judgment in judgments],
            next_cursor=_encode_cursor(next_cursor, sort=query.sort),
        )


def _validate_query(query: ListJudgmentsQuery) -> None:
    if query.limit < 1 or query.limit > MAX_JUDGMENT_LIST_LIMIT:
        raise InvalidJudgmentListFilterError(
            f"limit must be between 1 and {MAX_JUDGMENT_LIST_LIMIT}"
        )
    judged_from = query.judged_from
    judged_to = query.judged_to
    if judged_from is not None and judged_to is not None and judged_from > judged_to:
        raise InvalidJudgmentListFilterError("judged_from must be before judged_to")


def _encode_cursor(cursor: JudgmentListCursor | None, *, sort: JudgmentSort) -> str | None:
    if cursor is None:
        return None

    payload = {
        "v": _CURSOR_VERSION,
        "judged_at": cursor.judged_at.isoformat(),
        "judgment_id": str(cursor.judgment_id),
        "sort": sort.value,
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_cursor(raw_cursor: str | None, *, sort: JudgmentSort) -> JudgmentListCursor | None:
    if raw_cursor is None:
        return None

    try:
        padding = "=" * (-len(raw_cursor) % 4)
        decoded = base64.urlsafe_b64decode((raw_cursor + padding).encode()).decode()
        payload = json.loads(decoded)
        if not isinstance(payload, dict):
            raise ValueError("cursor payload must be an object")
        if payload.get("v") != _CURSOR_VERSION:
            raise ValueError("unsupported cursor version")
        if payload.get("sort") != sort.value:
            raise ValueError("cursor sort does not match request sort")
        return JudgmentListCursor(
            judged_at=datetime.fromisoformat(str(payload["judged_at"])),
            judgment_id=UUID(str(payload["judgment_id"])),
        )
    except (
        KeyError,
        TypeError,
        ValueError,
        UnicodeDecodeError,
        json.JSONDecodeError,
        binascii.Error,
    ) as exc:
        raise InvalidJudgmentCursorError("cursor is invalid") from exc

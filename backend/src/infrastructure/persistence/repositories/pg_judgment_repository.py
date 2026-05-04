"""Judgment リポジトリの PostgreSQL 実装。"""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from src.domain.entities.judgment import Judgment, JudgmentCorrection
from src.domain.repositories.judgment_repository import JudgmentRepository
from src.domain.value_objects.judgment_query import JudgmentListCursor, JudgmentSort
from src.domain.value_objects.judgment_result import BoundingBox
from src.domain.value_objects.verdict import Verdict
from src.infrastructure.persistence.models.judgment_model import JudgmentModel
from src.infrastructure.persistence.models.session_model import SessionModel


class PgJudgmentRepository(JudgmentRepository):
    """PostgreSQL 実装。commit / rollback は Unit of Work が担う。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, judgment: Judgment) -> None:
        self._session.add(
            JudgmentModel(
                id=judgment.id,
                session_id=judgment.session_id,
                verdict=judgment.verdict.value,
                score=judgment.score,
                advice=judgment.advice,
                corrections=[
                    _correction_to_jsonb(correction) for correction in judgment.corrections
                ],
                judged_at=judgment.judged_at,
            )
        )
        await self._session.flush()

    async def find_by_id(self, judgment_id: UUID) -> Judgment | None:
        stmt = select(JudgmentModel).where(JudgmentModel.id == judgment_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_judgment(model) if model is not None else None

    async def find_by_session_id(self, session_id: UUID) -> Judgment | None:
        stmt = select(JudgmentModel).where(JudgmentModel.session_id == session_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_judgment(model) if model is not None else None

    async def list_by_user(
        self,
        user_id: UUID,
        cursor: JudgmentListCursor | None,
        limit: int,
        *,
        verdict: Verdict | None = None,
        judged_from: datetime | None = None,
        judged_to: datetime | None = None,
        sort: JudgmentSort = JudgmentSort.JUDGED_AT_DESC,
    ) -> tuple[list[Judgment], JudgmentListCursor | None]:
        stmt = (
            select(JudgmentModel)
            .join(SessionModel, JudgmentModel.session_id == SessionModel.id)
            .where(SessionModel.user_id == user_id)
            .limit(limit + 1)
        )
        if verdict is not None:
            stmt = stmt.where(JudgmentModel.verdict == verdict.value)
        if judged_from is not None:
            stmt = stmt.where(JudgmentModel.judged_at >= judged_from)
        if judged_to is not None:
            stmt = stmt.where(JudgmentModel.judged_at <= judged_to)
        if cursor is not None:
            stmt = stmt.where(_cursor_condition(cursor, sort=sort))

        if sort is JudgmentSort.JUDGED_AT_ASC:
            stmt = stmt.order_by(JudgmentModel.judged_at.asc(), JudgmentModel.id.asc())
        else:
            stmt = stmt.order_by(JudgmentModel.judged_at.desc(), JudgmentModel.id.desc())

        result = await self._session.execute(stmt)
        models = list(result.scalars().all())
        next_cursor = None
        if len(models) > limit:
            cursor_model = models[limit - 1]
            next_cursor = JudgmentListCursor(
                judged_at=cursor_model.judged_at,
                judgment_id=cursor_model.id,
            )
            models = models[:limit]

        return [_to_judgment(model) for model in models], next_cursor


def _cursor_condition(cursor: JudgmentListCursor, *, sort: JudgmentSort) -> ColumnElement[bool]:
    if sort is JudgmentSort.JUDGED_AT_ASC:
        return or_(
            JudgmentModel.judged_at > cursor.judged_at,
            (JudgmentModel.judged_at == cursor.judged_at) & (JudgmentModel.id > cursor.judgment_id),
        )
    return or_(
        JudgmentModel.judged_at < cursor.judged_at,
        (JudgmentModel.judged_at == cursor.judged_at) & (JudgmentModel.id < cursor.judgment_id),
    )


def _correction_to_jsonb(correction: JudgmentCorrection) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "target_text": correction.target_text,
        "correct_text": correction.correct_text,
        "explanation": correction.explanation,
    }
    bbox = correction.bbox
    if bbox is not None:
        payload["bbox"] = {
            "x": bbox.x,
            "y": bbox.y,
            "width": bbox.width,
            "height": bbox.height,
        }
    return payload


def _to_judgment(model: JudgmentModel) -> Judgment:
    return Judgment(
        id=model.id,
        session_id=model.session_id,
        verdict=Verdict(model.verdict),
        score=model.score,
        advice=model.advice,
        corrections=[_jsonb_to_correction(correction) for correction in model.corrections],
        judged_at=model.judged_at,
    )


def _jsonb_to_correction(payload: dict[str, Any]) -> JudgmentCorrection:
    bbox_payload = payload.get("bbox")
    bbox = (
        BoundingBox(
            x=bbox_payload["x"],
            y=bbox_payload["y"],
            width=bbox_payload["width"],
            height=bbox_payload["height"],
        )
        if isinstance(bbox_payload, dict)
        else None
    )
    return JudgmentCorrection(
        target_text=payload["target_text"],
        correct_text=payload["correct_text"],
        explanation=payload["explanation"],
        bbox=bbox,
    )

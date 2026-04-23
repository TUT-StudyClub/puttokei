"""Judgment リポジトリの PostgreSQL 実装。"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.judgment import Judgment, JudgmentItem
from src.domain.repositories.judgment_repository import JudgmentRepository
from src.domain.value_objects.verdict import Verdict
from src.infrastructure.persistence.models.judgment_model import JudgmentModel


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
                items=[{"label": item.label, "comment": item.comment} for item in judgment.items],
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
        cursor: str | None,
        limit: int,
    ) -> tuple[list[Judgment], str | None]:
        del user_id, cursor, limit
        raise NotImplementedError("履歴一覧エンドポイントの Task で実装する")


def _to_judgment(model: JudgmentModel) -> Judgment:
    return Judgment(
        id=model.id,
        session_id=model.session_id,
        verdict=Verdict(model.verdict),
        score=model.score,
        advice=model.advice,
        items=[JudgmentItem(label=item["label"], comment=item["comment"]) for item in model.items],
        judged_at=model.judged_at,
    )

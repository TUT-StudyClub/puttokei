"""Output リポジトリの PostgreSQL 実装。"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.output import Output
from src.domain.repositories.output_repository import OutputRepository
from src.infrastructure.persistence.models.output_model import OutputModel


class PgOutputRepository(OutputRepository):
    """PostgreSQL 実装。commit / rollback は Unit of Work が担う。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(self, output: Output) -> None:
        stmt = select(OutputModel).where(OutputModel.session_id == output.session_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            self._session.add(
                OutputModel(
                    id=output.id,
                    session_id=output.session_id,
                    content=output.content,
                    submitted_at=output.submitted_at,
                )
            )
        else:
            model.id = output.id
            model.content = output.content
            model.submitted_at = output.submitted_at

        await self._session.flush()

    async def find_by_session_id(self, session_id: UUID) -> Output | None:
        stmt = select(OutputModel).where(OutputModel.session_id == session_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return _to_output(model) if model is not None else None


def _to_output(model: OutputModel) -> Output:
    return Output(
        id=model.id,
        session_id=model.session_id,
        content=model.content,
        submitted_at=model.submitted_at,
    )

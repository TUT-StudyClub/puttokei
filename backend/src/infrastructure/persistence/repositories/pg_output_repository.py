"""Output リポジトリの PostgreSQL 実装。"""

from uuid import UUID

from sqlalchemy import select

from src.domain.entities.output import Output
from src.domain.repositories.output_repository import OutputRepository
from src.infrastructure.persistence.database import Database
from src.infrastructure.persistence.models.output_model import OutputModel


class PgOutputRepository(OutputRepository):
    """PostgreSQL 実装。"""

    def __init__(self, database: Database) -> None:
        self._database = database

    async def upsert(self, output: Output) -> None:
        async with self._database.session() as db_session:
            stmt = select(OutputModel).where(OutputModel.session_id == output.session_id)
            result = await db_session.execute(stmt)
            model = result.scalar_one_or_none()

            if model is None:
                db_session.add(
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

            await db_session.commit()

    async def find_by_session_id(self, session_id: UUID) -> Output | None:
        async with self._database.session() as db_session:
            stmt = select(OutputModel).where(OutputModel.session_id == session_id)
            result = await db_session.execute(stmt)
            model = result.scalar_one_or_none()
            return _to_output(model) if model is not None else None


def _to_output(model: OutputModel) -> Output:
    return Output(
        id=model.id,
        session_id=model.session_id,
        content=model.content,
        submitted_at=model.submitted_at,
    )

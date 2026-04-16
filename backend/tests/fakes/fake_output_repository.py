"""インメモリな OutputRepository 実装。"""

from uuid import UUID

from src.domain.entities.output import Output
from src.domain.repositories.output_repository import OutputRepository


class FakeOutputRepository(OutputRepository):
    """in-memory な OutputRepository。テスト以外で使用しない。"""

    def __init__(self) -> None:
        self.outputs_by_session_id: dict[UUID, Output] = {}

    async def upsert(self, output: Output) -> None:
        self.outputs_by_session_id[output.session_id] = output

    async def find_by_session_id(self, session_id: UUID) -> Output | None:
        return self.outputs_by_session_id.get(session_id)

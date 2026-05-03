"""判定詳細取得のユースケース。"""

from uuid import UUID

from src.application.dto.judgment_dto import JudgmentView
from src.application.mappers.judgment_mapper import to_judgment_view
from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.user import User


class JudgmentNotFoundError(Exception):
    """当該 judgment が存在しない、または別ユーザーのため参照できない。"""


class GetJudgmentDetail:
    """ログインユーザーが参照できる判定詳細を返す。"""

    def __init__(
        self,
        *,
        unit_of_work_factory: UnitOfWorkFactory,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory

    async def execute(
        self,
        current_user: User,
        judgment_id: UUID,
    ) -> JudgmentView:
        async with self.unit_of_work_factory() as uow:
            judgment = await uow.judgments.find_by_id(judgment_id)
            if judgment is None:
                raise JudgmentNotFoundError("judgment not found")

            session = await uow.sessions.find_by_id(judgment.session_id)
            if session is None or session.user_id != current_user.id:
                raise JudgmentNotFoundError("judgment not found")

            return to_judgment_view(judgment)

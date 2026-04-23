"""Judgment と application DTO の変換。"""

from src.application.dto.judgment_dto import JudgmentItemView, JudgmentView
from src.domain.entities.judgment import Judgment


def to_judgment_view(judgment: Judgment) -> JudgmentView:
    """domain.Judgment を判定 view に変換する。"""
    return JudgmentView(
        id=judgment.id,
        session_id=judgment.session_id,
        verdict=judgment.verdict,
        score=judgment.score,
        advice=judgment.advice,
        items=[JudgmentItemView(label=item.label, comment=item.comment) for item in judgment.items],
        judged_at=judgment.judged_at,
    )

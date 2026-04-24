"""Judgment と application DTO の変換。"""

from src.application.dto.judgment_dto import JudgmentCorrectionView, JudgmentView
from src.domain.entities.judgment import Judgment


def to_judgment_view(judgment: Judgment) -> JudgmentView:
    """domain.Judgment を判定 view に変換する。"""
    return JudgmentView(
        id=judgment.id,
        session_id=judgment.session_id,
        verdict=judgment.verdict,
        score=judgment.score,
        advice=judgment.advice,
        corrections=[
            JudgmentCorrectionView(
                target_text=correction.target_text,
                correct_text=correction.correct_text,
                explanation=correction.explanation,
            )
            for correction in judgment.corrections
        ],
        judged_at=judgment.judged_at,
    )

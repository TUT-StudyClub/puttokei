"""判定結果取得のユースケース。"""

from datetime import UTC, datetime, timedelta
from math import ceil
from uuid import UUID, uuid4

from src.application.dto.judgment_dto import (
    JudgmentItemView,
    JudgmentPendingView,
    JudgmentView,
)
from src.domain.entities.judgment import Judgment, JudgmentItem
from src.domain.entities.output import Output
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.repositories.judgment_repository import JudgmentRepository
from src.domain.repositories.output_repository import OutputRepository
from src.domain.repositories.session_repository import SessionRepository
from src.domain.value_objects.session_status import SessionStatus
from src.domain.value_objects.verdict import Verdict

_PENDING_BUFFER_SECONDS = 10
_MIN_REJECTED_LENGTH = 20
_MIN_PARTIAL_LENGTH = 60
_MIN_CORRECT_LENGTH = 120


class SessionNotFoundError(Exception):
    """当該 session が存在しない、または別ユーザーのため参照できない。"""


class JudgmentNotAvailableError(Exception):
    """判定取得前のステータスであり、まだ結果取得フェーズではない。"""


class OutputNotSubmittedError(Exception):
    """判定対象のアウトプットがまだ保存されていない。"""


class GetJudgment:
    """判定結果を返す。未完了なら pending を返す。"""

    def __init__(
        self,
        session_repository: SessionRepository,
        output_repository: OutputRepository,
        judgment_repository: JudgmentRepository,
    ) -> None:
        self._session_repository = session_repository
        self._output_repository = output_repository
        self._judgment_repository = judgment_repository

    async def execute(
        self,
        current_user: User,
        session_id: UUID,
    ) -> JudgmentView | JudgmentPendingView:
        session = await self._session_repository.find_by_id(session_id)
        if session is None or session.user_id != current_user.id:
            raise SessionNotFoundError("session not found")

        if session.status in {SessionStatus.INPUT, SessionStatus.OUTPUT}:
            raise JudgmentNotAvailableError(
                f"cannot fetch judgment while session is {session.status.value}"
            )

        existing = await self._judgment_repository.find_by_session_id(session.id)
        if existing is not None:
            return _to_view(existing)

        output = await self._output_repository.find_by_session_id(session.id)
        if output is None:
            raise OutputNotSubmittedError("output not submitted")

        now = datetime.now(UTC)
        ready_at = output.submitted_at + timedelta(
            minutes=session.break_minutes,
            seconds=_PENDING_BUFFER_SECONDS,
        )
        if now < ready_at:
            return JudgmentPendingView(
                detail="判定結果を準備しています。少し待ってから再確認してください。",
                retry_after_seconds=max(1, ceil((ready_at - now).total_seconds())),
                estimated_ready_at=ready_at,
            )

        judgment = _build_mock_judgment(session, output, now)
        await self._judgment_repository.add(judgment)

        if session.status is not SessionStatus.JUDGED:
            await self._session_repository.update(
                session.with_status(new_status=SessionStatus.JUDGED, completed_at=now)
            )

        return _to_view(judgment)


def _build_mock_judgment(session: Session, output: Output, now: datetime) -> Judgment:
    """LLM 実装前の暫定判定。

    Issue #51 では pending / rejected / success の UX と API 契約を成立させることを優先し、
    本番の LLM 判定の代わりに本文量ベースの簡易ルールで Verdict を決める。
    """
    content = output.content.strip()

    if len(content) < _MIN_REJECTED_LENGTH:
        verdict = Verdict.REJECTED
        score = 0
        advice = "学習内容をもう少し具体的に書いてから、あらためて送信してください。"
        items = [
            JudgmentItem(
                label="入力内容の確認",
                comment="学習内容として判定できるだけの説明量が不足しています。",
            )
        ]
    elif len(content) >= _MIN_CORRECT_LENGTH:
        verdict = Verdict.CORRECT
        score = 90
        advice = "要点を十分に説明できています。この調子で具体例も添えるとさらに安定します。"
        items = [
            JudgmentItem(
                label=f"{session.topic} の理解",
                comment="主題とポイントが具体的に書かれており、理解度が高く見えます。",
            ),
            JudgmentItem(
                label="説明の具体性",
                comment="理由や根拠まで触れられており、再現性のある説明になっています。",
            ),
        ]
    elif len(content) >= _MIN_PARTIAL_LENGTH:
        verdict = Verdict.PARTIAL
        score = 72
        advice = "要点は押さえられています。定義と具体例をもう一歩足すと理解が安定します。"
        items = [
            JudgmentItem(
                label=f"{session.topic} の理解",
                comment="学習内容の要旨は書けていますが、補足説明があるとより明確です。",
            ),
            JudgmentItem(
                label="説明の具体性",
                comment="具体例や言い換えが増えると、自分の理解としてより伝わります。",
            ),
        ]
    else:
        verdict = Verdict.INCORRECT
        score = 45
        advice = (
            "説明が短く、理解の根拠がまだ見えにくい状態です。" "要点を整理して再挑戦してください。"
        )
        items = [
            JudgmentItem(
                label=f"{session.topic} の理解",
                comment="キーワードはありますが、内容のつながりがまだ十分ではありません。",
            ),
            JudgmentItem(
                label="説明の具体性",
                comment="学んだことを自分の言葉で 2〜3 文にすると判定しやすくなります。",
            ),
        ]

    return Judgment(
        id=uuid4(),
        session_id=session.id,
        verdict=verdict,
        score=score,
        advice=advice,
        items=items,
        judged_at=now,
    )


def _to_view(judgment: Judgment) -> JudgmentView:
    return JudgmentView(
        id=judgment.id,
        session_id=judgment.session_id,
        verdict=judgment.verdict,
        score=judgment.score,
        advice=judgment.advice,
        items=[JudgmentItemView(label=item.label, comment=item.comment) for item in judgment.items],
        judged_at=judgment.judged_at,
    )

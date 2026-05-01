"""ローカル LLM 判定を非同期に実行するユースケース。

`SubmitOutput` で output を保存した後、レスポンス送信から切り離して
fire-and-forget で起動する。Cloud Tasks による本実装が完了するまでの暫定的な
判定実行経路で、`presentation/api/v1/sessions.py` の `BackgroundTasks` 経由で
呼び出す想定。
"""

import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.judgment import Judgment, JudgmentCorrection
from src.domain.services.llm_judge_service import LLMJudgeService
from src.domain.value_objects.session_status import SessionStatus

logger = logging.getLogger(__name__)


class RunLocalJudgment:
    """LLM 判定を実行し、Judgment 保存と session→JUDGED 遷移を行う。"""

    def __init__(
        self,
        unit_of_work_factory: UnitOfWorkFactory,
        judge_service: LLMJudgeService,
    ) -> None:
        self.unit_of_work_factory = unit_of_work_factory
        self.judge_service = judge_service

    async def execute(self, session_id: UUID) -> None:
        """指定 session の output を判定し、結果を保存する。

        BackgroundTasks 経由で呼ばれる前提のため、例外はここで握りつぶしてログに残す。
        リクエスト本体（output 保存）は既にコミット済みで、判定失敗してもユーザーは
        セッションを進められる。リトライは将来 Cloud Tasks 実装で担保する。
        """
        try:
            await self._run(session_id)
        except Exception:
            logger.exception(
                "RunLocalJudgment failed for session_id=%s. session remains in JUDGING.",
                session_id,
            )

    async def _run(self, session_id: UUID) -> None:
        async with self.unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(session_id)
            if session is None:
                logger.warning("RunLocalJudgment: session not found id=%s", session_id)
                return

            if session.status is SessionStatus.JUDGED:
                # 既に判定済み（再投入時のレース等）。冪等に no-op。
                return

            existing_judgment = await uow.judgments.find_by_session_id(session.id)
            if existing_judgment is not None:
                # 何らかの経路で既に保存済み。冪等に no-op。
                return

            output = await uow.outputs.find_by_session_id(session.id)
            if output is None:
                logger.warning(
                    "RunLocalJudgment: output not found for session_id=%s",
                    session_id,
                )
                return

            judged_at = datetime.now(UTC)
            result = await self.judge_service.judge(
                prompt_input=session.topic,
                user_output=output.content,
            )
            await uow.judgments.add(
                Judgment(
                    id=uuid4(),
                    session_id=session.id,
                    verdict=result.verdict,
                    score=result.score,
                    advice=result.advice,
                    corrections=[
                        JudgmentCorrection(
                            target_text=correction.target_text,
                            correct_text=correction.correct_text,
                            explanation=correction.explanation,
                        )
                        for correction in result.corrections
                    ],
                    judged_at=judged_at,
                )
            )

            updated_session = session.with_status(
                new_status=SessionStatus.JUDGED,
                completed_at=judged_at,
            )
            await uow.sessions.update(updated_session)

            await uow.commit()

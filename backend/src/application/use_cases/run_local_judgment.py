"""ローカル LLM 判定を非同期に実行するユースケース。

`SubmitOutput` で output を保存した後、レスポンス送信から切り離して
fire-and-forget で起動する。Cloud Tasks による本実装が完了するまでの暫定的な
判定実行経路で、`presentation/api/v1/sessions.py` の `BackgroundTasks` 経由で
呼び出す想定。
"""

import logging
from contextlib import suppress
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from src.application.unit_of_work import UnitOfWorkFactory
from src.domain.entities.judgment import Judgment, JudgmentCorrection
from src.domain.entities.judgment_progress import JudgmentProgress
from src.domain.entities.output import Output
from src.domain.entities.session import Session
from src.domain.services.llm_judge_service import LLMJudgeService
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.domain.value_objects.judgment_result import JudgmentResult
from src.domain.value_objects.session_status import SessionStatus

logger = logging.getLogger(__name__)

type SaveResultStatus = Literal["saved", "already_done", "stale_output", "cancelled"]

_PROGRESS_MESSAGES: dict[JudgmentProgressStage, str] = {
    JudgmentProgressStage.QUEUED: "判定をキューに登録しました。",
    JudgmentProgressStage.PREPARING_PROMPT: "判定用のプロンプトを準備しています。",
    JudgmentProgressStage.REQUESTING_LLM: "AI に判定を依頼しています。",
    JudgmentProgressStage.RECEIVING_LLM: "AI から判定内容を受信しています。",
    JudgmentProgressStage.VALIDATING_RESPONSE: "AI の判定結果を検証しています。",
    JudgmentProgressStage.SAVING_RESULT: "判定結果を保存しています。",
    JudgmentProgressStage.COMPLETED: "採点が完了しました。",
    JudgmentProgressStage.FAILED: "判定に失敗しました。時間をおいて再確認してください。",
}


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
                "RunLocalJudgment failed for session_id=%s. judgment progress was marked failed.",
                session_id,
            )

    async def _run(self, session_id: UUID) -> None:
        session, output, no_work_needed = await self._load_target(session_id)
        if no_work_needed:
            return
        if session is None:
            logger.warning("RunLocalJudgment: session not found id=%s", session_id)
            return
        if output is None:
            await self._update_progress(
                session_id=session_id,
                status=JudgmentProgressStatus.FAILED,
                stage=JudgmentProgressStage.FAILED,
                percent=100,
                message="判定対象のアウトプットが見つかりません。",
                error_code="output_not_found",
                completed_at=datetime.now(UTC),
            )
            return

        try:
            await self._judge_and_save(session_id=session_id, session=session, output=output)
        except Exception as exc:
            with suppress(Exception):
                await self._update_progress(
                    session_id=session_id,
                    status=JudgmentProgressStatus.FAILED,
                    stage=JudgmentProgressStage.FAILED,
                    percent=100,
                    message=_PROGRESS_MESSAGES[JudgmentProgressStage.FAILED],
                    completed_at=datetime.now(UTC),
                    error_code=exc.__class__.__name__,
                    expected_output=output,
                )
            raise

    async def _judge_and_save(self, *, session_id: UUID, session: Session, output: Output) -> None:
        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.PREPARING_PROMPT,
            percent=15,
            message=_PROGRESS_MESSAGES[JudgmentProgressStage.PREPARING_PROMPT],
            expected_output=output,
        )
        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.REQUESTING_LLM,
            percent=35,
            message=_PROGRESS_MESSAGES[JudgmentProgressStage.REQUESTING_LLM],
            expected_output=output,
        )

        async def report_receiving(chunk_count: int) -> None:
            await self._update_progress(
                session_id=session_id,
                status=JudgmentProgressStatus.RUNNING,
                stage=JudgmentProgressStage.RECEIVING_LLM,
                percent=min(80, 45 + chunk_count * 5),
                message=_PROGRESS_MESSAGES[JudgmentProgressStage.RECEIVING_LLM],
                expected_output=output,
            )

        result = await self.judge_service.judge(
            prompt_input=session.topic,
            user_output=output.content,
            progress_callback=report_receiving,
        )

        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.VALIDATING_RESPONSE,
            percent=85,
            message=_PROGRESS_MESSAGES[JudgmentProgressStage.VALIDATING_RESPONSE],
            expected_output=output,
        )
        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.SAVING_RESULT,
            percent=92,
            message=_PROGRESS_MESSAGES[JudgmentProgressStage.SAVING_RESULT],
            expected_output=output,
        )

        judged_at = datetime.now(UTC)
        save_status = await self._save_result(
            session=session,
            output=output,
            result=result,
            judged_at=judged_at,
        )
        if save_status == "stale_output":
            return
        if save_status == "cancelled":
            await self._update_progress(
                session_id=session_id,
                status=JudgmentProgressStatus.FAILED,
                stage=JudgmentProgressStage.FAILED,
                percent=100,
                message="セッションが中断されたため判定を終了しました。",
                completed_at=judged_at,
                error_code="session_cancelled",
            )
            return
        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.COMPLETED,
            stage=JudgmentProgressStage.COMPLETED,
            percent=100,
            message=_PROGRESS_MESSAGES[JudgmentProgressStage.COMPLETED],
            completed_at=judged_at,
        )

    async def _load_target(
        self, session_id: UUID
    ) -> tuple[Session | None, Output | None, bool]:
        async with self.unit_of_work_factory() as uow:
            session = await uow.sessions.find_by_id(session_id)
            if session is None:
                return None, None, False

            if session.status is SessionStatus.JUDGED:
                # 既に判定済み（再投入時のレース等）。冪等に no-op。
                await self._update_progress(
                    session_id=session.id,
                    status=JudgmentProgressStatus.COMPLETED,
                    stage=JudgmentProgressStage.COMPLETED,
                    percent=100,
                    message=_PROGRESS_MESSAGES[JudgmentProgressStage.COMPLETED],
                    completed_at=session.completed_at or datetime.now(UTC),
                )
                return None, None, True

            existing_judgment = await uow.judgments.find_by_session_id(session.id)
            if existing_judgment is not None:
                # 何らかの経路で既に保存済み。冪等に no-op。
                await self._update_progress(
                    session_id=session.id,
                    status=JudgmentProgressStatus.COMPLETED,
                    stage=JudgmentProgressStage.COMPLETED,
                    percent=100,
                    message=_PROGRESS_MESSAGES[JudgmentProgressStage.COMPLETED],
                    completed_at=existing_judgment.judged_at,
                )
                return None, None, True

            output = await uow.outputs.find_by_session_id(session.id)
            return session, output, False

    async def _save_result(
        self,
        *,
        session: Session,
        output: Output,
        result: JudgmentResult,
        judged_at: datetime,
    ) -> SaveResultStatus:
        async with self.unit_of_work_factory() as uow:
            current_session = await uow.sessions.find_by_id(session.id)
            if current_session is None:
                logger.warning("RunLocalJudgment: session not found id=%s", session.id)
                return "cancelled"

            if current_session.status is SessionStatus.CANCELLED:
                return "cancelled"

            existing_judgment = await uow.judgments.find_by_session_id(session.id)
            if existing_judgment is not None:
                return "already_done"

            current_output = await uow.outputs.find_by_session_id(session.id)
            if current_output is None or not _is_same_output(current_output, output):
                return "stale_output"

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

            updated_session = current_session.with_status(
                new_status=SessionStatus.JUDGED,
                completed_at=judged_at,
            )
            await uow.sessions.update(updated_session)

            await uow.commit()
            return "saved"

    async def _update_progress(
        self,
        *,
        session_id: UUID,
        status: JudgmentProgressStatus,
        stage: JudgmentProgressStage,
        percent: int,
        message: str,
        completed_at: datetime | None = None,
        error_code: str | None = None,
        expected_output: Output | None = None,
    ) -> None:
        now = datetime.now(UTC)
        async with self.unit_of_work_factory() as uow:
            if expected_output is not None:
                current_output = await uow.outputs.find_by_session_id(session_id)
                if current_output is None or not _is_same_output(current_output, expected_output):
                    return

            await uow.judgment_progresses.upsert(
                JudgmentProgress(
                    session_id=session_id,
                    status=status,
                    stage=stage,
                    percent=max(0, min(100, percent)),
                    message=message,
                    event_seq=1,
                    started_at=now,
                    updated_at=now,
                    completed_at=completed_at,
                    error_code=error_code,
                )
            )
            await uow.commit()


def _is_same_output(current: Output, expected: Output) -> bool:
    return (
        current.id == expected.id
        and current.submitted_at == expected.submitted_at
        and current.content == expected.content
    )

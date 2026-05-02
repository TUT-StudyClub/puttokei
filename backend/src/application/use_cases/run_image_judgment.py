"""画像アウトプット判定の非同期実行ユースケース。"""

from datetime import UTC, datetime
from uuid import UUID

from src.application.unit_of_work import UnitOfWorkFactory
from src.application.use_cases._run_judgment_base import (
    PROGRESS_MESSAGES,
    RunJudgmentBase,
)
from src.domain.entities.output import Output
from src.domain.entities.session import Session
from src.domain.services.llm_judge_service import LLMJudgeService
from src.domain.services.output_image_storage import OutputImageStorage
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.domain.value_objects.output_kind import OutputKind


class UnsupportedOutputKindError(Exception):
    """画像判定 UseCase にテキストアウトプットが渡された等の整合性エラー。"""


class RunImageJudgment(RunJudgmentBase):
    """画像 Output を GCS から取得して LLM で判定し、結果を保存する。"""

    log_name = "RunImageJudgment"

    def __init__(
        self,
        unit_of_work_factory: UnitOfWorkFactory,
        judge_service: LLMJudgeService,
        storage: OutputImageStorage,
    ) -> None:
        super().__init__(unit_of_work_factory)
        self.judge_service = judge_service
        self.storage = storage

    async def _judge_and_save(
        self,
        *,
        session_id: UUID,
        session: Session,
        output: Output,
    ) -> None:
        if output.kind is not OutputKind.IMAGE or output.image_storage_path is None:
            raise UnsupportedOutputKindError(
                f"RunImageJudgment received non-image output kind={output.kind.value}"
            )

        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.DOWNLOADING_IMAGE,
            percent=10,
            message=PROGRESS_MESSAGES[JudgmentProgressStage.DOWNLOADING_IMAGE],
            expected_output=output,
        )
        image_bytes, mime_type = await self.storage.download(storage_path=output.image_storage_path)

        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.ENCODING_IMAGE,
            percent=25,
            message=PROGRESS_MESSAGES[JudgmentProgressStage.ENCODING_IMAGE],
            expected_output=output,
        )
        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.PREPARING_PROMPT,
            percent=35,
            message=PROGRESS_MESSAGES[JudgmentProgressStage.PREPARING_PROMPT],
            expected_output=output,
        )
        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.REQUESTING_LLM,
            percent=50,
            message=PROGRESS_MESSAGES[JudgmentProgressStage.REQUESTING_LLM],
            expected_output=output,
        )

        async def report_receiving(chunk_count: int) -> None:
            await self._update_progress(
                session_id=session_id,
                status=JudgmentProgressStatus.RUNNING,
                stage=JudgmentProgressStage.RECEIVING_LLM,
                percent=min(85, 60 + chunk_count * 5),
                message=PROGRESS_MESSAGES[JudgmentProgressStage.RECEIVING_LLM],
                expected_output=output,
            )

        result = await self.judge_service.judge_image(
            prompt_input=session.topic,
            image_bytes=image_bytes,
            image_mime_type=mime_type,
            progress_callback=report_receiving,
        )

        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.VALIDATING_RESPONSE,
            percent=88,
            message=PROGRESS_MESSAGES[JudgmentProgressStage.VALIDATING_RESPONSE],
            expected_output=output,
        )
        await self._update_progress(
            session_id=session_id,
            status=JudgmentProgressStatus.RUNNING,
            stage=JudgmentProgressStage.SAVING_RESULT,
            percent=94,
            message=PROGRESS_MESSAGES[JudgmentProgressStage.SAVING_RESULT],
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
            message=PROGRESS_MESSAGES[JudgmentProgressStage.COMPLETED],
            completed_at=judged_at,
        )

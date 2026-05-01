"""RunLocalJudgment UseCase の振る舞い。"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from src.application.use_cases.run_local_judgment import RunLocalJudgment
from src.domain.entities.judgment import Judgment, JudgmentCorrection
from src.domain.entities.output import Output
from src.domain.entities.session import Session
from src.domain.entities.user import User
from src.domain.services.llm_judge_service import LLMJudgeService, LLMProgressCallback
from src.domain.value_objects.auth_provider import AuthProvider
from src.domain.value_objects.judgment_progress import (
    JudgmentProgressStage,
    JudgmentProgressStatus,
)
from src.domain.value_objects.judgment_result import JudgmentResult
from src.domain.value_objects.session_status import SessionStatus
from src.domain.value_objects.verdict import Verdict
from src.infrastructure.llm.local_judge_service import LocalJudgeService
from tests.fakes.fake_judgment_progress_repository import FakeJudgmentProgressRepository
from tests.fakes.fake_judgment_repository import FakeJudgmentRepository
from tests.fakes.fake_output_repository import FakeOutputRepository
from tests.fakes.fake_session_repository import FakeSessionRepository
from tests.fakes.fake_unit_of_work import FakeUnitOfWork


def _make_user() -> User:
    now = datetime.now(UTC)
    return User(
        id=uuid4(),
        firebase_uid="uid-001",
        auth_provider=AuthProvider.GOOGLE,
        display_name=None,
        age_group=None,
        onboarding_completed=True,
        created_at=now,
        updated_at=now,
    )


def _make_session_in_judging(user: User) -> Session:
    now = datetime.now(UTC)
    return Session(
        id=uuid4(),
        user_id=user.id,
        status=SessionStatus.JUDGING,
        subject="歴史",
        topic="本能寺の変",
        input_minutes=20,
        output_minutes=5,
        break_minutes=5,
        started_at=now,
        completed_at=None,
        created_at=now,
    )


def _make_output(session: Session) -> Output:
    return Output(
        id=uuid4(),
        session_id=session.id,
        content="明智光秀が織田信長を本能寺で討った出来事について、背景と経緯を含めて整理しました。",
        submitted_at=datetime.now(UTC),
    )


class _RaisingJudgeService(LLMJudgeService):
    async def judge(
        self,
        prompt_input: str,
        user_output: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        del prompt_input, user_output, progress_callback
        raise RuntimeError("LLM provider failure")


class _CancellingJudgeService(LLMJudgeService):
    def __init__(self, sessions: FakeSessionRepository, session: Session) -> None:
        self.sessions = sessions
        self.session = session

    async def judge(
        self,
        prompt_input: str,
        user_output: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        del prompt_input, user_output, progress_callback
        await self.sessions.update(self.session.with_status(new_status=SessionStatus.CANCELLED))
        return JudgmentResult(
            verdict=Verdict.CORRECT,
            score=90,
            advice="判定結果です。",
            corrections=[],
        )


class _ResubmittingJudgeService(LLMJudgeService):
    def __init__(self, outputs: FakeOutputRepository, output: Output) -> None:
        self.outputs = outputs
        self.output = output

    async def judge(
        self,
        prompt_input: str,
        user_output: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        del prompt_input, user_output, progress_callback
        await self.outputs.upsert(
            self.output.model_copy(
                update={
                    "content": "再送信された新しいアウトプットです。",
                    "submitted_at": datetime.now(UTC),
                }
            )
        )
        return JudgmentResult(
            verdict=Verdict.CORRECT,
            score=90,
            advice="古いアウトプットへの判定結果です。",
            corrections=[],
        )


@pytest.mark.asyncio
async def test_run_local_judgment_saves_judgment_and_marks_session_as_judged():
    user = _make_user()
    session = _make_session_in_judging(user)
    output = _make_output(session)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    judgments = FakeJudgmentRepository()
    judgment_progresses = FakeJudgmentProgressRepository()
    await sessions.add(session)
    await outputs.upsert(output)

    use_case = RunLocalJudgment(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            outputs=outputs,
            judgments=judgments,
            judgment_progresses=judgment_progresses,
        ),
        judge_service=LocalJudgeService(),
    )

    await use_case.execute(session.id)

    saved_session = await sessions.find_by_id(session.id)
    saved_judgment = await judgments.find_by_session_id(session.id)
    saved_progress = await judgment_progresses.find_by_session_id(session.id)
    assert saved_session is not None
    assert saved_session.status is SessionStatus.JUDGED
    assert saved_session.completed_at is not None
    assert saved_judgment is not None
    assert saved_judgment.score > 0
    assert saved_progress is not None
    assert saved_progress.status is JudgmentProgressStatus.COMPLETED
    assert saved_progress.stage is JudgmentProgressStage.COMPLETED
    assert saved_progress.percent == 100


@pytest.mark.asyncio
async def test_run_local_judgment_is_idempotent_when_judgment_already_exists():
    """既に Judgment がある場合は no-op で session も書き換えない。"""
    user = _make_user()
    session = _make_session_in_judging(user)
    output = _make_output(session)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    judgments = FakeJudgmentRepository()
    judgment_progresses = FakeJudgmentProgressRepository()
    await sessions.add(session)
    await outputs.upsert(output)
    existing = Judgment(
        id=uuid4(),
        session_id=session.id,
        verdict=Verdict.PARTIAL,
        score=50,
        advice="既存の判定",
        corrections=[
            JudgmentCorrection(
                target_text="既存", correct_text="保持", explanation="既存値を維持する想定"
            )
        ],
        judged_at=datetime.now(UTC),
    )
    await judgments.add(existing)

    use_case = RunLocalJudgment(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            outputs=outputs,
            judgments=judgments,
            judgment_progresses=judgment_progresses,
        ),
        judge_service=LocalJudgeService(),
    )

    await use_case.execute(session.id)

    saved_session = await sessions.find_by_id(session.id)
    saved_judgment = await judgments.find_by_session_id(session.id)
    saved_progress = await judgment_progresses.find_by_session_id(session.id)
    assert saved_session is not None
    # 既に Judgment がある場合 session は JUDGING のまま据え置きで干渉しない
    assert saved_session.status is SessionStatus.JUDGING
    assert saved_judgment is not None
    assert saved_judgment.id == existing.id
    assert saved_progress is not None
    assert saved_progress.status is JudgmentProgressStatus.COMPLETED


@pytest.mark.asyncio
async def test_run_local_judgment_swallows_llm_errors():
    """LLM 例外時はログに残してリクエストには影響させない（session は JUDGING のまま）。"""
    user = _make_user()
    session = _make_session_in_judging(user)
    output = _make_output(session)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    judgments = FakeJudgmentRepository()
    judgment_progresses = FakeJudgmentProgressRepository()
    await sessions.add(session)
    await outputs.upsert(output)

    use_case = RunLocalJudgment(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            outputs=outputs,
            judgments=judgments,
            judgment_progresses=judgment_progresses,
        ),
        judge_service=_RaisingJudgeService(),
    )

    # 例外を投げず、呼び出し側に伝搬しない
    await use_case.execute(session.id)

    saved_session = await sessions.find_by_id(session.id)
    saved_judgment = await judgments.find_by_session_id(session.id)
    saved_progress = await judgment_progresses.find_by_session_id(session.id)
    assert saved_session is not None
    assert saved_session.status is SessionStatus.JUDGING
    assert saved_judgment is None
    assert saved_progress is not None
    assert saved_progress.status is JudgmentProgressStatus.FAILED
    assert saved_progress.stage is JudgmentProgressStage.FAILED
    assert saved_progress.error_code == "RuntimeError"


@pytest.mark.asyncio
async def test_run_local_judgment_does_not_overwrite_cancelled_session():
    user = _make_user()
    session = _make_session_in_judging(user)
    output = _make_output(session)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    judgments = FakeJudgmentRepository()
    judgment_progresses = FakeJudgmentProgressRepository()
    await sessions.add(session)
    await outputs.upsert(output)

    use_case = RunLocalJudgment(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            outputs=outputs,
            judgments=judgments,
            judgment_progresses=judgment_progresses,
        ),
        judge_service=_CancellingJudgeService(sessions, session),
    )

    await use_case.execute(session.id)

    saved_session = await sessions.find_by_id(session.id)
    saved_judgment = await judgments.find_by_session_id(session.id)
    saved_progress = await judgment_progresses.find_by_session_id(session.id)
    assert saved_session is not None
    assert saved_session.status is SessionStatus.CANCELLED
    assert saved_judgment is None
    assert saved_progress is not None
    assert saved_progress.status is JudgmentProgressStatus.FAILED
    assert saved_progress.error_code == "session_cancelled"


@pytest.mark.asyncio
async def test_run_local_judgment_does_not_save_stale_output_result():
    user = _make_user()
    session = _make_session_in_judging(user)
    output = _make_output(session)
    sessions = FakeSessionRepository()
    outputs = FakeOutputRepository()
    judgments = FakeJudgmentRepository()
    judgment_progresses = FakeJudgmentProgressRepository()
    await sessions.add(session)
    await outputs.upsert(output)

    use_case = RunLocalJudgment(
        unit_of_work_factory=lambda: FakeUnitOfWork(
            sessions=sessions,
            outputs=outputs,
            judgments=judgments,
            judgment_progresses=judgment_progresses,
        ),
        judge_service=_ResubmittingJudgeService(outputs, output),
    )

    await use_case.execute(session.id)

    saved_session = await sessions.find_by_id(session.id)
    saved_judgment = await judgments.find_by_session_id(session.id)
    saved_progress = await judgment_progresses.find_by_session_id(session.id)
    assert saved_session is not None
    assert saved_session.status is SessionStatus.JUDGING
    assert saved_judgment is None
    assert saved_progress is not None
    assert saved_progress.status is JudgmentProgressStatus.RUNNING

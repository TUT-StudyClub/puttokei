"""ローカル開発用の同期判定サービス。"""

from src.domain.services.llm_judge_service import LLMJudgeService
from src.domain.value_objects.judgment_result import JudgmentItem, JudgmentResult
from src.domain.value_objects.verdict import Verdict

_MIN_REJECTED_LENGTH = 20
_MIN_PARTIAL_LENGTH = 60
_MIN_CORRECT_LENGTH = 120


class LocalJudgeService(LLMJudgeService):
    """Cloud Tasks 導入前にローカルで判定表示を確認するための軽量実装。"""

    async def judge(self, prompt_input: str, user_output: str) -> JudgmentResult:
        content = user_output.strip()

        if len(content) < _MIN_REJECTED_LENGTH:
            return JudgmentResult(
                verdict=Verdict.REJECTED,
                score=0,
                advice="学習内容をもう少し具体的に書いてから、あらためて送信してください。",
                items=[
                    JudgmentItem(
                        label="入力内容の確認",
                        comment="学習内容として判定できるだけの説明量が不足しています。",
                    )
                ],
            )

        if len(content) >= _MIN_CORRECT_LENGTH:
            return JudgmentResult(
                verdict=Verdict.CORRECT,
                score=90,
                advice="要点を十分に説明できています。具体例や理由も添えられています。",
                items=[
                    JudgmentItem(
                        label=f"{prompt_input} の理解",
                        comment="主題とポイントが具体的に書かれており、理解度が高く見えます。",
                    ),
                    JudgmentItem(
                        label="説明の具体性",
                        comment="理由や根拠まで触れられており、再現性のある説明になっています。",
                    ),
                ],
            )

        if len(content) >= _MIN_PARTIAL_LENGTH:
            return JudgmentResult(
                verdict=Verdict.PARTIAL,
                score=72,
                advice="要点は押さえられています。定義と具体例をもう一歩足すと理解が安定します。",
                items=[
                    JudgmentItem(
                        label=f"{prompt_input} の理解",
                        comment="学習内容の要旨は書けていますが、補足説明があるとより明確です。",
                    ),
                    JudgmentItem(
                        label="説明の具体性",
                        comment="具体例や言い換えが増えると、自分の理解としてより伝わります。",
                    ),
                ],
            )

        return JudgmentResult(
            verdict=Verdict.INCORRECT,
            score=45,
            advice="説明が短く、理解の根拠がまだ見えにくい状態です。要点を整理しましょう。",
            items=[
                JudgmentItem(
                    label=f"{prompt_input} の理解",
                    comment="キーワードはありますが、内容のつながりがまだ十分ではありません。",
                ),
                JudgmentItem(
                    label="説明の具体性",
                    comment="学んだことを自分の言葉で 2〜3 文にすると判定しやすくなります。",
                ),
            ],
        )

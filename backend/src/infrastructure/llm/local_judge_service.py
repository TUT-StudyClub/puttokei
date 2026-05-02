"""ローカル開発用の同期判定サービス。"""

from src.domain.services.llm_judge_service import LLMJudgeService, LLMProgressCallback
from src.domain.value_objects.judgment_result import JudgmentCorrection, JudgmentResult
from src.domain.value_objects.verdict import Verdict

_MIN_REJECTED_LENGTH = 20
_MIN_PARTIAL_LENGTH = 60
_MIN_CORRECT_LENGTH = 120

_PREVIEW_LENGTH = 12


def _preview(content: str) -> str:
    """アウトプット冒頭を抜き出し、`target_text` のダミー値として使う。"""
    stripped = content.strip()
    if len(stripped) <= _PREVIEW_LENGTH:
        return stripped
    return stripped[:_PREVIEW_LENGTH]


class LocalJudgeService(LLMJudgeService):
    """Cloud Tasks 導入前にローカルで判定表示を確認するための軽量実装。"""

    async def judge_image(
        self,
        prompt_input: str,
        image_bytes: bytes,
        image_mime_type: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        del prompt_input, image_bytes, image_mime_type, progress_callback
        raise NotImplementedError(
            "LocalJudgeService は画像判定に対応していません。LLM_PROVIDER=gemini を使ってください。"
        )

    async def judge_text(
        self,
        prompt_input: str,
        user_output: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        if progress_callback is not None:
            await progress_callback(1)

        content = user_output.strip()

        if len(content) < _MIN_REJECTED_LENGTH:
            return JudgmentResult(
                verdict=Verdict.REJECTED,
                score=0,
                advice="学習内容をもう少し具体的に書いてから、あらためて送信してください。",
                corrections=[],
            )

        if len(content) >= _MIN_CORRECT_LENGTH:
            return JudgmentResult(
                verdict=Verdict.CORRECT,
                score=90,
                advice="要点を十分に説明できています。具体例や理由も添えられています。",
                corrections=[],
            )

        if len(content) >= _MIN_PARTIAL_LENGTH:
            return JudgmentResult(
                verdict=Verdict.PARTIAL,
                score=72,
                advice="要点は押さえられています。定義と具体例をもう一歩足すと理解が安定します。",
                corrections=[
                    JudgmentCorrection(
                        target_text=_preview(content),
                        correct_text=f"{prompt_input} の要点を 1〜2 文で簡潔にまとめる",
                        explanation=(
                            "冒頭で結論を示し、続けて理由や具体例を補足すると、"
                            "自分の理解として伝わりやすくなります。"
                        ),
                    ),
                ],
            )

        return JudgmentResult(
            verdict=Verdict.INCORRECT,
            score=45,
            advice="説明が短く、理解の根拠がまだ見えにくい状態です。要点を整理しましょう。",
            corrections=[
                JudgmentCorrection(
                    target_text=_preview(content),
                    correct_text=f"{prompt_input} について要点と具体例を 2〜3 文で書く",
                    explanation=(
                        "キーワードだけでなく、それぞれの関係や理由まで書くと、"
                        "学習内容として判定しやすくなります。"
                    ),
                ),
            ],
        )

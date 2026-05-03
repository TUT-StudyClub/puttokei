"""LLM 判定サービスの抽象 IF。

具体実装はプロバイダーごとに `infrastructure/llm/*_provider.py` に置き、
`infrastructure/llm/factory.py` で組み立てる。
"""

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable

from src.domain.value_objects.judgment_result import JudgmentResult

type LLMProgressCallback = Callable[[int], Awaitable[None]]


class LLMJudgeService(ABC):
    """学習アウトプットを LLM で判定する抽象 IF。"""

    @abstractmethod
    async def judge_text(
        self,
        prompt_input: str,
        user_output: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        """テキストアウトプットを判定し、JSON 化された判定結果を返す。"""

    @abstractmethod
    async def judge_image(
        self,
        prompt_input: str,
        image_bytes: bytes,
        image_mime_type: str,
        progress_callback: LLMProgressCallback | None = None,
    ) -> JudgmentResult:
        """画像アウトプットを判定し、JSON 化された判定結果を返す。"""

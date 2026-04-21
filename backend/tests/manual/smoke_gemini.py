"""GeminiProvider を手動確認する CLI。"""

from __future__ import annotations

import asyncio
import json
from dataclasses import asdict

from src.config import LLMSettings
from src.domain.services.llm_judge_service import LLMJudgmentInput
from src.infrastructure.llm.base import (
    LLMAuthenticationError,
    LLMRateLimitError,
)
from src.infrastructure.llm.factory import create_llm_provider


async def _main() -> None:
    settings = LLMSettings()
    provider = create_llm_provider(settings)
    result = await provider.judge(
        LLMJudgmentInput(
            subject="英語",
            topic="現在完了",
            content="現在完了は過去の出来事が現在に影響しているときに使う表現です。",
            age_group="10s",
            prompt_version="v1",
        )
    )
    print(json.dumps(asdict(result), ensure_ascii=False, indent=2))


def main() -> None:
    try:
        asyncio.run(_main())
    except LLMAuthenticationError as exc:
        raise SystemExit(str(exc)) from exc
    except LLMRateLimitError as exc:
        raise SystemExit(
            "Gemini API の利用上限に達したため、手動スモークを中断しました。\n" f"{exc}"
        ) from exc


if __name__ == "__main__":
    main()

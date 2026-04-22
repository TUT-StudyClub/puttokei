"""LLM prompt の組み立て。"""

from src.domain.services.llm_judge_service import LLMJudgmentInput
from src.infrastructure.llm.prompts.v1 import SYSTEM_PROMPT, build_v1_prompt


def build_prompt_pair(input_data: LLMJudgmentInput) -> tuple[str, str]:
    """prompt_version に応じた system / user prompt を返す。"""

    match input_data.prompt_version:
        case "v1":
            return SYSTEM_PROMPT, build_v1_prompt(input_data)
        case _:
            raise ValueError(f"Unsupported prompt version: {input_data.prompt_version}")


__all__ = ["build_prompt_pair"]

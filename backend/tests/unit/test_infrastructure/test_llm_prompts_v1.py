"""LLM prompt v1 の unit tests。"""

from src.domain.services.llm_judge_service import LLMJudgmentInput
from src.infrastructure.llm.prompts.v1 import SYSTEM_PROMPT, build_v1_prompt


def test_system_prompt_contains_few_shot_examples_and_no_ai_wording() -> None:
    assert "採点 AI" not in SYSTEM_PROMPT
    assert "採点者" in SYSTEM_PROMPT
    assert "例1: 主張を分けて採点する" in SYSTEM_PROMPT
    assert "例2: 根拠不足は推測しない" in SYSTEM_PROMPT
    assert '"verdict": "rejected"' in SYSTEM_PROMPT


def test_build_v1_prompt_includes_input_fields() -> None:
    prompt = build_v1_prompt(
        LLMJudgmentInput(
            subject="理科",
            topic="光合成",
            content="植物が光を使って養分を作るはたらきです。",
            age_group="10s",
            prompt_version="v1",
        )
    )

    assert "システム指示のルールと例にならって採点してください。" in prompt
    assert "出力は JSON のみで返してください。" in prompt
    assert "科目: 理科" in prompt
    assert "トピック: 光合成" in prompt
    assert "年齢区分: 10s" in prompt
    assert "学習アウトプット:" in prompt
    assert "植物が光を使って養分を作るはたらきです。" in prompt


def test_build_v1_prompt_omits_age_group_when_missing() -> None:
    prompt = build_v1_prompt(
        LLMJudgmentInput(
            subject="数学",
            topic="極限",
            content="ある値に限りなく近づく考え方です。",
            age_group=None,
            prompt_version="v1",
        )
    )

    assert "年齢区分:" not in prompt

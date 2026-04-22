"""LLM prompt の unit tests。"""

from src.domain.services.llm_judge_service import LLMJudgmentInput
from src.infrastructure.llm.prompts.builder import LLMJudgmentPromptBuilder


def test_system_prompt_contains_few_shot_examples_and_no_ai_wording() -> None:
    prompt_builder = LLMJudgmentPromptBuilder(
        LLMJudgmentInput(
            subject="理科",
            topic="光合成",
            content="植物が光を使って養分を作るはたらきです。",
            age_group="10s",
        )
    )

    assert "採点 AI" not in prompt_builder.system_prompt
    assert "採点者" in prompt_builder.system_prompt
    assert "例1: 主張を分けて採点する" in prompt_builder.system_prompt
    assert "例2: 根拠不足は推測しない" in prompt_builder.system_prompt
    assert '"verdict": "rejected"' in prompt_builder.system_prompt


def test_user_prompt_includes_input_fields() -> None:
    prompt_builder = LLMJudgmentPromptBuilder(
        LLMJudgmentInput(
            subject="理科",
            topic="光合成",
            content="植物が光を使って養分を作るはたらきです。",
            age_group="10s",
        )
    )
    _, user_prompt = prompt_builder.prompt_pair

    assert "システム指示のルールと例にならって採点してください。" in user_prompt
    assert "出力は JSON のみで返してください。" in user_prompt
    assert "科目: 理科" in user_prompt
    assert "トピック: 光合成" in user_prompt
    assert "年齢区分: 10s" in user_prompt
    assert "学習アウトプット:" in user_prompt
    assert "植物が光を使って養分を作るはたらきです。" in user_prompt


def test_user_prompt_omits_age_group_when_missing() -> None:
    prompt_builder = LLMJudgmentPromptBuilder(
        LLMJudgmentInput(
            subject="数学",
            topic="極限",
            content="ある値に限りなく近づく考え方です。",
            age_group=None,
        )
    )
    _, user_prompt = prompt_builder.prompt_pair

    assert "年齢区分:" not in user_prompt

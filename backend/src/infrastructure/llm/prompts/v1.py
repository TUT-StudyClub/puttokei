"""LLM 判定プロンプト v1。"""

from __future__ import annotations

from src.domain.services.llm_judge_service import LLMJudgmentInput

SYSTEM_PROMPT = """
あなたは学習内容の採点 AI です。
ユーザーのアウトプットを主張単位に分解し、各主張の正誤を JSON で返してください。
判定不能な場合は「判定不能」とし、推測で答えないでください。
学習と無関係な入力は verdict="rejected" を返してください。
""".strip()


def build_v1_prompt(judgment_input: LLMJudgmentInput) -> str:
    """Gemini に渡すユーザープロンプトを組み立てる。"""

    lines = [
        "以下の学習アウトプットを採点してください。",
        f"科目: {judgment_input.subject}",
        f"トピック: {judgment_input.topic}",
    ]
    if judgment_input.age_group:
        lines.append(f"年齢区分: {judgment_input.age_group}")
    lines.extend(
        [
            "ユーザーのアウトプット:",
            judgment_input.content,
        ]
    )
    return "\n".join(lines)

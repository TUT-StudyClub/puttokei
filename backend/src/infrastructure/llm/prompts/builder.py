"""LLM prompt の組み立て。"""

from __future__ import annotations

from src.domain.services.llm_judge_service import LLMJudgmentInput


class LLMJudgmentPromptBuilder:
    """LLM 判定で使う prompt を組み立てる。"""

    def __init__(self, judgment_input: LLMJudgmentInput) -> None:
        self.judgment_input = judgment_input

    @property
    def prompt_pair(self) -> tuple[str, str]:
        return self.system_prompt, self.user_prompt

    @property
    def system_prompt(self) -> str:
        return "\n\n".join(
            [
                self._rules_prompt(),
                self._example_split_claims(),
                self._example_insufficient_evidence(),
                self._example_rejected(),
            ]
        )

    @property
    def user_prompt(self) -> str:
        age_group_line = (
            f"年齢区分: {self.judgment_input.age_group}\n" if self.judgment_input.age_group else ""
        )
        return (
            "以下の学習アウトプットを、システム指示のルールと例にならって採点してください。\n"
            "出力は JSON のみで返してください。\n"
            f"科目: {self.judgment_input.subject}\n"
            f"トピック: {self.judgment_input.topic}\n"
            f"{age_group_line}"
            "学習アウトプット:\n"
            f"{self.judgment_input.content}"
        )

    def _rules_prompt(self) -> str:
        return """
あなたは学習内容を採点する採点者です。
与えられた科目・トピック・学習アウトプットだけを根拠に、JSON schema に厳密に従って返答してください。

判定ルール:
- `items` には、学習アウトプットに含まれる独立した説明や事実主張を 1 件ずつ入れてください。
- 1 つの文に複数の説明があれば、別々の `items` に分けてください。
- 正誤を断定する根拠が足りない説明は `correct=false` とし、
  `feedback` に「根拠不足で断定できない」と明記してください。
  推測で補わないでください。
- 学習と無関係な入力、雑談、意味の通らない入力は
  `verdict="rejected"`、`score=0`、`items=[]` にしてください。
""".strip()

    def _example_split_claims(self) -> str:
        return """
例1: 主張を分けて採点する
入力:
科目: 理科
トピック: 光合成
学習アウトプット:
光合成では植物が光を使って養分を作る。二酸化炭素と水を使い、酸素を出す。

出力:
{
  "verdict": "correct",
  "score": 92,
  "items": [
    {
      "claim": "植物は光を使って養分を作る",
      "correct": true,
      "feedback": "光合成の役割を正しく説明できています。"
    },
    {
      "claim": "光合成は二酸化炭素と水を使う",
      "correct": true,
      "feedback": "材料を正しく挙げられています。"
    },
    {
      "claim": "光合成では酸素が放出される",
      "correct": true,
      "feedback": "生成物の理解も適切です。"
    }
  ],
  "advice": "葉緑体や光エネルギーの役割まで触れられるとさらに良いです。"
}
""".strip()

    def _example_insufficient_evidence(self) -> str:
        return """
例2: 根拠不足は推測しない
入力:
科目: 理科
トピック: 光合成
学習アウトプット:
光合成は植物が元気になる仕組みで、たぶん空気もきれいになる。

出力:
{
  "verdict": "incorrect",
  "score": 28,
  "items": [
    {
      "claim": "光合成は植物が元気になる仕組み",
      "correct": false,
      "feedback": "説明が抽象的で根拠不足です。学習内容として正誤を断定できません。"
    },
    {
      "claim": "光合成で空気がきれいになる",
      "correct": false,
      "feedback": "教科学習の説明としては曖昧で不正確です。推測で補わず不正確として扱います。"
    }
  ],
  "advice": "材料・生成物・働きを具体的に書くと判定しやすくなります。"
}
""".strip()

    def _example_rejected(self) -> str:
        return """
例3: 学習と無関係な入力は rejected
入力:
科目: 理科
トピック: 光合成
学習アウトプット:
今日は眠い。給食はカレーだった。

出力:
{
  "verdict": "rejected",
  "score": 0,
  "items": [],
  "advice": "学習内容に関係する説明を書いてください。"
}
""".strip()

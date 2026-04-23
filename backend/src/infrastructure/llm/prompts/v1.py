"""LLM 判定用プロンプト v1。"""

from textwrap import dedent
from typing import Any


def build_judgment_prompt(*, topic: str, user_output: str) -> str:
    """学習アウトプット判定用のプロンプトを返す。"""
    return dedent(
        f"""
        あなたは学習支援AIです。学習者がトピックについて説明したアウトプットを評価してください。

        ## 目的
        - 学習者の説明に含まれる主張を見て、内容が正しいかを評価する
        - 誤りがある場合は、学習者が書いた本文中の誤り箇所を正確に指摘する
        - フィードバックは高校生にもわかる自然な日本語で書く

        ## 判定ルール
        1. トピックに照らして、アウトプットの主張を正誤判定する
        2. すべて正しければ `correct`
        3. 一部に誤りや重要な不足があれば `partial`
        4. 主要な主張が誤っていれば `incorrect`
        5. 極端に短い、トピックと無関係、意味が取れない、判定材料がほぼ無い場合は `rejected`
        6. `corrections` の `target_text` は、必ず学習者の本文に実際に含まれる
           連続した文字列をそのまま使う
        7. 本文に誤りが無ければ `corrections` は空配列にする
        8. 推測で誤りを作らず、不明な点は総合アドバイス側で補足する

        ## 出力要件
        - JSON だけを返す
        - `score` は 0 から 100 の整数
        - `advice` は総合フィードバックを 1〜3 文で書く
        - `corrections` は最大 3 件程度に絞る
        - `correct_text` は、学習者がそのまま言い換えて覚えやすい表現にする

        ## 学習トピック
        {topic}

        ## 学習者のアウトプット
        {user_output}
        """
    ).strip()


def judgment_response_json_schema() -> dict[str, Any]:
    """Gemini structured output 用の JSON Schema を返す。"""
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "verdict": {
                "type": "string",
                "enum": ["correct", "partial", "incorrect", "rejected"],
                "description": "学習アウトプット全体の判定結果。",
            },
            "score": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100,
                "description": "総合スコア。",
            },
            "advice": {
                "type": "string",
                "description": "学習者向けの総合フィードバック。高校生にもわかる自然な日本語。",
            },
            "corrections": {
                "type": "array",
                "description": "学習者本文の具体的な誤り指摘。誤りが無ければ空配列。",
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "target_text": {
                            "type": "string",
                            "description": (
                                "学習者本文中の誤っている箇所。" "そのまま抜き出した連続文字列。"
                            ),
                        },
                        "correct_text": {
                            "type": "string",
                            "description": "target_text をどう直せばよいかを示す正しい表現。",
                        },
                        "explanation": {
                            "type": "string",
                            "description": "誤りの理由と正しい内容の簡潔な解説。",
                        },
                    },
                    "required": ["target_text", "correct_text", "explanation"],
                },
            },
        },
        "required": ["verdict", "score", "advice", "corrections"],
    }

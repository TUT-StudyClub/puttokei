"""判定結果 JSON のスキーマ。テキスト判定 / 画像判定で共有する。"""

from typing import Any


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
                                "学習者本文中の誤っている箇所。"
                                "テキスト判定では本文中の連続文字列、"
                                "画像判定ではノートに書かれていた文言の抜粋。"
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

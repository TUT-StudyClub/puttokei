"""staging Cloud SQL にデモ用の過去 30 日分データを投入するスクリプト。

実行モデル:
- 1 セッション = input 20 分 + output 5 分 + break 5 分 (計 30 分)
- 1 日 3 セッション (JST 09:00 / 13:00 / 19:00 開始)
- 期間は --days で指定 (デフォルト 30 日)、終端は前日 (today - 1)
- すべての session は status=judged で完了済み体裁
- judgment は LLM を呼ばず、verdict 比率 (correct 60% / partial 30% / incorrect 10%) を
  事前確定してシャッフルし、advice/corrections テンプレで埋める
- アウトプット文は 5 教科 × 4 トピック × 3 verdict = 60 パターン

使い方:
    1) Cloud SQL Auth Proxy を別ターミナルで起動
        cloud-sql-proxy hourglass-f10ca:asia-northeast1:puttokei-pg-staging --port 5433
    2) Secret Manager から DATABASE_URL を取得し localhost:5433 用に書き換え
        DB_URL_RAW=$(gcloud secrets versions access latest \\
            --secret=puttokei-database-url-staging --project=hourglass-f10ca)
        DB_URL=$(printf '%s' "$DB_URL_RAW" | sed -E \\
            's#@/([^?]+)\\?host=/cloudsql/[^"]+#@localhost:5433/\\1#')
    3) dry-run で投入予定を確認
        uv run python scripts/seed_demo_30days.py \\
            --db-url "$DB_URL" \\
            --user-uid FUUh8ukg3sbSofGrHXmja3aeyYI3
    4) 問題なければ --apply で実投入
        uv run python scripts/seed_demo_30days.py \\
            --db-url "$DB_URL" \\
            --user-uid FUUh8ukg3sbSofGrHXmja3aeyYI3 \\
            --apply
"""

from __future__ import annotations

import argparse
import asyncio
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

# scripts/ から実行するため、src を import path に追加する。
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from src.infrastructure.persistence.models.judgment_model import JudgmentModel  # noqa: E402
from src.infrastructure.persistence.models.output_model import OutputModel  # noqa: E402
from src.infrastructure.persistence.models.session_model import SessionModel  # noqa: E402
from src.infrastructure.persistence.models.study_subject_model import (  # noqa: E402
    OutputSubjectAssignmentModel,
    StudySubjectModel,
)
from src.infrastructure.persistence.models.user_model import UserModel  # noqa: E402

JST = ZoneInfo("Asia/Tokyo")

# ───────────────────────────────────────────────────────────
# マスタデータ
# ───────────────────────────────────────────────────────────


@dataclass(frozen=True)
class TopicSpec:
    subject: str
    topic: str


# 5 教科、各 4 トピック = 20 トピック
SUBJECT_COLORS: dict[str, str] = {
    "数学": "#4F8FFF",
    "英語": "#FF6B6B",
    "物理": "#51CF66",
    "化学": "#FFD43B",
    "日本史": "#B197FC",
}

TOPICS: list[TopicSpec] = [
    TopicSpec("数学", "二次関数"),
    TopicSpec("数学", "三角比"),
    TopicSpec("数学", "数列"),
    TopicSpec("数学", "微分の基礎"),
    TopicSpec("英語", "関係代名詞"),
    TopicSpec("英語", "仮定法"),
    TopicSpec("英語", "不定詞"),
    TopicSpec("英語", "現在完了"),
    TopicSpec("物理", "等加速度運動"),
    TopicSpec("物理", "力学的エネルギー保存則"),
    TopicSpec("物理", "波の干渉"),
    TopicSpec("物理", "オームの法則"),
    TopicSpec("化学", "酸化還元反応"),
    TopicSpec("化学", "モル計算"),
    TopicSpec("化学", "有機化合物の分類"),
    TopicSpec("化学", "化学平衡"),
    TopicSpec("日本史", "鎌倉幕府の成立"),
    TopicSpec("日本史", "江戸時代の三大改革"),
    TopicSpec("日本史", "明治維新"),
    TopicSpec("日本史", "戦後の高度経済成長"),
]

# 各 topic に対して verdict 別の本文 + corrections テンプレを用意。
# correct → corrections 空 / partial → 1 件 / incorrect → 2 件。
TopicContent = dict[str, dict[str, object]]
CONTENT_BY_TOPIC: dict[str, TopicContent] = {
    "二次関数": {
        "correct": {
            "content": (
                "y = ax² + bx + c の二次関数は、a>0 で下に凸、a<0 で上に凸のグラフを描く。"
                "頂点の x 座標は x = -b/(2a) で、平方完成すれば標準形 y = a(x-p)² + q が得られる。"
                "判別式 D = b² - 4ac の符号で x 軸との交点の数が決まる。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "y = ax² + bx + c の二次関数は a>0 で上に凸になる。"
                "頂点の x 座標は x = -b/(2a) で、判別式 D = b² - 4ac が正なら x 軸と 2 点で交わる。"
            ),
            "corrections": [
                {
                    "target_text": "a>0 で上に凸",
                    "correct_text": "a>0 で下に凸",
                    "explanation": "二次の係数 a が正のとき、グラフは下に凸 (U 字型) になる。上下が逆になっている。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "y = ax² + bx + c の頂点の x 座標は x = b/(2a) で求められる。"
                "判別式は D = b² + 4ac で、これが負なら実数解はない。"
            ),
            "corrections": [
                {
                    "target_text": "x = b/(2a)",
                    "correct_text": "x = -b/(2a)",
                    "explanation": "頂点の x 座標は -b/(2a)。符号を落としているため正負が逆になっている。",
                },
                {
                    "target_text": "D = b² + 4ac",
                    "correct_text": "D = b² - 4ac",
                    "explanation": "判別式は b² から 4ac を引く。+ ではなく - が正しい。",
                },
            ],
        },
    },
    "三角比": {
        "correct": {
            "content": (
                "直角三角形において、sinθ = 対辺/斜辺、cosθ = 隣辺/斜辺、tanθ = 対辺/隣辺。"
                "三平方の定理から sin²θ + cos²θ = 1 が成り立ち、tanθ = sinθ/cosθ。"
                "30°, 45°, 60° の三角比は頻出で暗記推奨。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "sinθ = 対辺/斜辺、cosθ = 隣辺/斜辺、tanθ = 隣辺/対辺。"
                "sin²θ + cos²θ = 1 が常に成立する。"
            ),
            "corrections": [
                {
                    "target_text": "tanθ = 隣辺/対辺",
                    "correct_text": "tanθ = 対辺/隣辺",
                    "explanation": "tanθ は対辺を隣辺で割る。分子分母が逆になっている。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "sinθ = 斜辺/対辺、cosθ = 斜辺/隣辺、tanθ = 対辺/隣辺。"
                "sin²θ - cos²θ = 1 が成り立つ。"
            ),
            "corrections": [
                {
                    "target_text": "sinθ = 斜辺/対辺",
                    "correct_text": "sinθ = 対辺/斜辺",
                    "explanation": "sinθ は対辺/斜辺。分子分母を入れ替えてしまっている。",
                },
                {
                    "target_text": "sin²θ - cos²θ = 1",
                    "correct_text": "sin²θ + cos²θ = 1",
                    "explanation": "三平方の定理から導かれる関係は + であって、- ではない。",
                },
            ],
        },
    },
    "数列": {
        "correct": {
            "content": (
                "等差数列の一般項は a_n = a_1 + (n-1)d、初項から第 n 項までの和は S_n = n(a_1 + a_n)/2。"
                "等比数列の一般項は a_n = a_1 · r^(n-1)、和は r ≠ 1 のとき S_n = a_1(1 - r^n)/(1 - r)。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "等差数列の一般項は a_n = a_1 + n·d、和は S_n = n(a_1 + a_n)/2。"
                "等比数列の和は S_n = a_1(1 - r^n)/(1 - r)。"
            ),
            "corrections": [
                {
                    "target_text": "a_n = a_1 + n·d",
                    "correct_text": "a_n = a_1 + (n-1)d",
                    "explanation": "等差数列の一般項は (n-1) 項分加算する。n のままだと 1 項ずれる。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "等差数列の一般項は a_n = a_1 · n·d、和は S_n = (a_1 + a_n)/2。"
                "等比数列の一般項は a_n = a_1 + r^n。"
            ),
            "corrections": [
                {
                    "target_text": "a_n = a_1 · n·d",
                    "correct_text": "a_n = a_1 + (n-1)d",
                    "explanation": "等差数列の一般項は加算であって積ではない。",
                },
                {
                    "target_text": "a_n = a_1 + r^n",
                    "correct_text": "a_n = a_1 · r^(n-1)",
                    "explanation": "等比数列の一般項は初項に公比の (n-1) 乗を掛ける。和ではなく積。",
                },
            ],
        },
    },
    "微分の基礎": {
        "correct": {
            "content": (
                "関数 f(x) の x = a における微分係数は f'(a) = lim[h→0] (f(a+h) - f(a))/h。"
                "x^n の導関数は n·x^(n-1)。和の微分、定数倍、積の微分公式 (fg)' = f'g + fg' を使い分ける。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "x^n を微分すると n·x^(n+1) になる。積の微分は (fg)' = f'g + fg'。"
            ),
            "corrections": [
                {
                    "target_text": "n·x^(n+1)",
                    "correct_text": "n·x^(n-1)",
                    "explanation": "ベキ関数の微分では指数を 1 下げる。+1 ではなく -1 が正しい。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "x^n を微分すると x^(n-1) になる。積の微分は (fg)' = f'g - fg'。"
            ),
            "corrections": [
                {
                    "target_text": "x^(n-1)",
                    "correct_text": "n·x^(n-1)",
                    "explanation": "係数として元の指数 n を掛けるのを忘れている。",
                },
                {
                    "target_text": "(fg)' = f'g - fg'",
                    "correct_text": "(fg)' = f'g + fg'",
                    "explanation": "積の微分公式は和。- にすると誤り。",
                },
            ],
        },
    },
    "関係代名詞": {
        "correct": {
            "content": (
                "関係代名詞 who は人を先行詞、which は物を先行詞、that は両方に使える。"
                "目的格の whom は文脈によって省略可能。コンマ付きの非制限用法 (which/who) は補足説明を加える。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "関係代名詞 who は人を先行詞、which は物を先行詞にとる。"
                "that は人にも物にも使えるが、非制限用法では使えない。"
                "目的格の whom は決して省略できない。"
            ),
            "corrections": [
                {
                    "target_text": "whom は決して省略できない",
                    "correct_text": "目的格の whom は省略可能",
                    "explanation": "目的格の関係代名詞は省略できる。制限が逆。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "関係代名詞 who は物を先行詞にとり、which は人を先行詞にとる。"
                "that は非制限用法で必ず使う。"
            ),
            "corrections": [
                {
                    "target_text": "who は物を先行詞にとり、which は人を先行詞にとる",
                    "correct_text": "who は人、which は物を先行詞にとる",
                    "explanation": "用法が完全に逆。who=人、which=物が原則。",
                },
                {
                    "target_text": "that は非制限用法で必ず使う",
                    "correct_text": "that は非制限用法では使えない",
                    "explanation": "that は制限用法のみ。コンマ付きの非制限用法では which/who を使う。",
                },
            ],
        },
    },
    "仮定法": {
        "correct": {
            "content": (
                "仮定法過去は現在の事実に反する仮定。If + 過去形, 主語 + would/could + 動詞原形。"
                "仮定法過去完了は過去の事実に反する仮定。If + 過去完了, 主語 + would have + 過去分詞。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "仮定法過去は現在の事実に反する仮定で If + 過去形, 主語 + will + 動詞原形。"
                "仮定法過去完了は過去の事実に反する仮定で If + 過去完了, 主語 + would have + 過去分詞。"
            ),
            "corrections": [
                {
                    "target_text": "主語 + will + 動詞原形",
                    "correct_text": "主語 + would/could + 動詞原形",
                    "explanation": "仮定法過去では助動詞の過去形 would/could を使う。will は直説法。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "仮定法過去は過去の事実に反する仮定で If + 現在形, 主語 + will + 動詞原形を使う。"
            ),
            "corrections": [
                {
                    "target_text": "過去の事実に反する仮定",
                    "correct_text": "現在の事実に反する仮定",
                    "explanation": "仮定法過去は現在の仮定。過去の仮定は仮定法過去完了。",
                },
                {
                    "target_text": "If + 現在形, 主語 + will + 動詞原形",
                    "correct_text": "If + 過去形, 主語 + would/could + 動詞原形",
                    "explanation": "仮定法過去は時制を 1 つ過去にずらして表す。",
                },
            ],
        },
    },
    "不定詞": {
        "correct": {
            "content": (
                "不定詞 to + 動詞原形には名詞用法 (〜すること)、形容詞用法 (〜するための)、"
                "副詞用法 (〜するために) がある。It is + 形容詞 + to do の形式主語構文も頻出。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "不定詞 to + 動詞原形には名詞用法と副詞用法があり、それぞれ「〜すること」「〜するために」を表す。"
                "形容詞用法は存在しない。"
            ),
            "corrections": [
                {
                    "target_text": "形容詞用法は存在しない",
                    "correct_text": "形容詞用法もある",
                    "explanation": "不定詞には名詞・形容詞・副詞の三用法がすべて存在する。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "不定詞 to + 動詞原形は常に「〜すること」を意味し、副詞用法は ing 形が担当する。"
            ),
            "corrections": [
                {
                    "target_text": "常に「〜すること」を意味し",
                    "correct_text": "「〜すること」「〜するための」「〜するために」など複数の用法がある",
                    "explanation": "不定詞は名詞・形容詞・副詞の三用法を持つ。",
                },
                {
                    "target_text": "副詞用法は ing 形が担当する",
                    "correct_text": "副詞用法は不定詞自身が担う",
                    "explanation": "副詞用法 (〜するために) は to 不定詞の用法の一つ。動名詞ではない。",
                },
            ],
        },
    },
    "現在完了": {
        "correct": {
            "content": (
                "現在完了 have + 過去分詞は完了・経験・継続・結果の 4 用法を表す。"
                "since + 起点、for + 期間、ever / never / yet / already などが共起しやすい。"
                "明確な過去を示す yesterday や last week とは併用できない。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "現在完了 have + 過去分詞は完了・経験・継続・結果の 4 用法を表す。"
                "yesterday や last week と併用できる。"
            ),
            "corrections": [
                {
                    "target_text": "yesterday や last week と併用できる",
                    "correct_text": "yesterday や last week とは併用できない",
                    "explanation": "現在完了は明確な過去の時点を示す副詞とは共起しない。過去形を使う。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "現在完了 has + 動詞原形で、過去から現在までの時間を表す。"
                "always I yesterday went there のように現在完了で過去の時点を述べられる。"
            ),
            "corrections": [
                {
                    "target_text": "has + 動詞原形",
                    "correct_text": "has/have + 過去分詞",
                    "explanation": "現在完了は have/has + 過去分詞。動詞原形ではない。",
                },
                {
                    "target_text": "現在完了で過去の時点を述べられる",
                    "correct_text": "現在完了は明確な過去の時点と併用できない",
                    "explanation": "yesterday などの過去時点を表す語と現在完了は共起しない。",
                },
            ],
        },
    },
    "等加速度運動": {
        "correct": {
            "content": (
                "等加速度運動では速度 v = v_0 + at、変位 x = v_0·t + (1/2)at²、"
                "v² - v_0² = 2ax の三式が基本。重力加速度 g ≒ 9.8 m/s² の自由落下が代表例。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "等加速度運動では速度は v = v_0 + at、変位は x = v_0·t + at² で求められる。"
            ),
            "corrections": [
                {
                    "target_text": "x = v_0·t + at²",
                    "correct_text": "x = v_0·t + (1/2)at²",
                    "explanation": "変位の式の加速度項には 1/2 が掛かる。係数を落としている。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "等加速度運動では速度は v = v_0 - at、変位は x = v_0 + at² で求められる。"
            ),
            "corrections": [
                {
                    "target_text": "v = v_0 - at",
                    "correct_text": "v = v_0 + at",
                    "explanation": "符号は加速度の向きで決まるが、定義式は + が原則。",
                },
                {
                    "target_text": "x = v_0 + at²",
                    "correct_text": "x = v_0·t + (1/2)at²",
                    "explanation": "v_0 はそのままではなく t を掛ける。加速度項にも 1/2 が必要。",
                },
            ],
        },
    },
    "力学的エネルギー保存則": {
        "correct": {
            "content": (
                "保存力のみが働く系では運動エネルギー K = (1/2)mv² と位置エネルギー U = mgh の和が一定。"
                "K_1 + U_1 = K_2 + U_2 が成立。摩擦など非保存力が働く場合は熱として散逸する。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "運動エネルギーは K = mv²、位置エネルギーは U = mgh で、保存力のみなら K + U が一定。"
            ),
            "corrections": [
                {
                    "target_text": "K = mv²",
                    "correct_text": "K = (1/2)mv²",
                    "explanation": "運動エネルギーには 1/2 が必要。係数を落としている。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "運動エネルギーは K = mgh、位置エネルギーは U = (1/2)mv² で表される。"
                "摩擦が働いていても K + U は常に一定。"
            ),
            "corrections": [
                {
                    "target_text": "運動エネルギーは K = mgh、位置エネルギーは U = (1/2)mv²",
                    "correct_text": "K = (1/2)mv²、U = mgh",
                    "explanation": "運動エネルギーと位置エネルギーの式が完全に逆。",
                },
                {
                    "target_text": "摩擦が働いていても K + U は常に一定",
                    "correct_text": "摩擦などの非保存力下では K + U は減少する",
                    "explanation": "摩擦は熱として散逸させるため、力学的エネルギーは保存しない。",
                },
            ],
        },
    },
    "波の干渉": {
        "correct": {
            "content": (
                "二つの波源からの距離差が波長 λ の整数倍 (mλ) のとき強め合い、"
                "(m + 1/2)λ のとき弱め合う。ヤングの実験では明線間隔 Δy = λL/d で表される。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "二つの波源からの距離差が波長の整数倍のとき強め合い、半波長ずれると弱め合う。"
                "ヤングの実験の明線間隔は Δy = λd/L で表される。"
            ),
            "corrections": [
                {
                    "target_text": "Δy = λd/L",
                    "correct_text": "Δy = λL/d",
                    "explanation": "ヤングの干渉では分母にスリット間隔 d が来る。L と d の位置が逆。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "二つの波源からの距離差が半波長の整数倍のとき強め合い、波長の整数倍のとき弱め合う。"
            ),
            "corrections": [
                {
                    "target_text": "半波長の整数倍のとき強め合い",
                    "correct_text": "波長の整数倍のとき強め合い",
                    "explanation": "強め合いは波長 λ の整数倍。条件が逆。",
                },
                {
                    "target_text": "波長の整数倍のとき弱め合う",
                    "correct_text": "(m + 1/2)λ のとき弱め合う",
                    "explanation": "弱め合いの条件は半波長ずれた場合。",
                },
            ],
        },
    },
    "オームの法則": {
        "correct": {
            "content": (
                "電圧 V、電流 I、抵抗 R の関係は V = IR。直列接続では合成抵抗 R = R_1 + R_2、"
                "並列接続では 1/R = 1/R_1 + 1/R_2。消費電力は P = VI = I²R = V²/R。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "オームの法則は V = IR で表される。"
                "並列接続の合成抵抗は R = R_1 + R_2 で求められる。"
            ),
            "corrections": [
                {
                    "target_text": "並列接続の合成抵抗は R = R_1 + R_2",
                    "correct_text": "並列接続では 1/R = 1/R_1 + 1/R_2",
                    "explanation": "並列接続は逆数和。R = R_1 + R_2 は直列接続の式。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "オームの法則は V = I + R。直列接続の合成抵抗は 1/R = 1/R_1 + 1/R_2。"
            ),
            "corrections": [
                {
                    "target_text": "V = I + R",
                    "correct_text": "V = IR",
                    "explanation": "電圧は電流と抵抗の積。和ではない。",
                },
                {
                    "target_text": "直列接続の合成抵抗は 1/R = 1/R_1 + 1/R_2",
                    "correct_text": "直列は R = R_1 + R_2、並列は 1/R = 1/R_1 + 1/R_2",
                    "explanation": "直列と並列が逆になっている。",
                },
            ],
        },
    },
    "酸化還元反応": {
        "correct": {
            "content": (
                "酸化は電子を失うこと、還元は電子を受け取ること。酸化数の増加が酸化、減少が還元。"
                "酸化剤は相手を酸化し自身は還元される。半反応式を組み合わせてイオン反応式を作る。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "酸化は電子を受け取ること、還元は電子を失うこと。"
                "酸化数の増加が酸化、減少が還元。"
            ),
            "corrections": [
                {
                    "target_text": "酸化は電子を受け取ること、還元は電子を失うこと",
                    "correct_text": "酸化は電子を失うこと、還元は電子を受け取ること",
                    "explanation": "酸化と還元の電子の動きが逆になっている。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "酸化は電子を受け取り、酸化数は減少する。酸化剤は自身が酸化される物質である。"
            ),
            "corrections": [
                {
                    "target_text": "酸化は電子を受け取り、酸化数は減少する",
                    "correct_text": "酸化は電子を失い、酸化数が増加する",
                    "explanation": "電子の授受と酸化数の動きが両方とも逆。",
                },
                {
                    "target_text": "酸化剤は自身が酸化される物質",
                    "correct_text": "酸化剤は相手を酸化し自身は還元される物質",
                    "explanation": "酸化剤の働きが逆になっている。",
                },
            ],
        },
    },
    "モル計算": {
        "correct": {
            "content": (
                "1 mol = 6.02 × 10²³ 個 (アボガドロ定数)。物質量 n = 質量 m / モル質量 M で求める。"
                "気体は標準状態 (0°C, 1 atm) で 1 mol = 22.4 L を占める。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "1 mol = 6.02 × 10²³ 個。物質量は n = 質量 × モル質量で求める。"
            ),
            "corrections": [
                {
                    "target_text": "n = 質量 × モル質量",
                    "correct_text": "n = 質量 / モル質量",
                    "explanation": "物質量は質量をモル質量で割って求める。積ではない。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "1 mol = 6.02 × 10¹⁰ 個。気体は標準状態で 1 mol = 11.2 L を占める。"
            ),
            "corrections": [
                {
                    "target_text": "6.02 × 10¹⁰",
                    "correct_text": "6.02 × 10²³",
                    "explanation": "アボガドロ定数の指数が違う。10²³ が正しい。",
                },
                {
                    "target_text": "1 mol = 11.2 L",
                    "correct_text": "1 mol = 22.4 L",
                    "explanation": "標準状態の気体 1 mol の体積は 22.4 L。半分の値になっている。",
                },
            ],
        },
    },
    "有機化合物の分類": {
        "correct": {
            "content": (
                "炭化水素は鎖式 (脂肪族) と環式 (脂環・芳香族) に大別される。"
                "官能基によりアルコール (-OH)、カルボン酸 (-COOH)、エステル (-COO-)、"
                "アミン (-NH₂) などに分類される。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "炭化水素は鎖式と環式に分類される。"
                "アルコールの官能基は -COOH である。"
            ),
            "corrections": [
                {
                    "target_text": "アルコールの官能基は -COOH",
                    "correct_text": "アルコールの官能基は -OH",
                    "explanation": "-COOH はカルボン酸の官能基。アルコールはヒドロキシ基 -OH を持つ。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "炭化水素はすべて鎖式に分類される。"
                "アミンの官能基は -OH、アルコールの官能基は -NH₂ である。"
            ),
            "corrections": [
                {
                    "target_text": "炭化水素はすべて鎖式に分類される",
                    "correct_text": "炭化水素は鎖式と環式に分類される",
                    "explanation": "ベンゼンなどの環式構造を持つ化合物もある。",
                },
                {
                    "target_text": "アミンの官能基は -OH、アルコールの官能基は -NH₂",
                    "correct_text": "アミンは -NH₂、アルコールは -OH",
                    "explanation": "官能基が完全に逆になっている。",
                },
            ],
        },
    },
    "化学平衡": {
        "correct": {
            "content": (
                "可逆反応 aA + bB ⇌ cC + dD では、平衡定数 K = [C]^c[D]^d / [A]^a[B]^b。"
                "ル・シャトリエの原理により、外部からの摂動 (濃度・温度・圧力) を緩和する向きに平衡は移動する。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "平衡定数は K = [A]^a[B]^b / [C]^c[D]^d で表される。"
                "温度を上げると吸熱方向に平衡が移動する。"
            ),
            "corrections": [
                {
                    "target_text": "K = [A]^a[B]^b / [C]^c[D]^d",
                    "correct_text": "K = [C]^c[D]^d / [A]^a[B]^b",
                    "explanation": "平衡定数は生成物濃度を分子、反応物濃度を分母に置く。式が逆。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "化学平衡では反応物と生成物の濃度が必ず等しくなる。"
                "ル・シャトリエの原理によれば、温度を上げると発熱方向に進む。"
            ),
            "corrections": [
                {
                    "target_text": "反応物と生成物の濃度が必ず等しくなる",
                    "correct_text": "正反応と逆反応の速度が等しくなる",
                    "explanation": "平衡では速度が釣り合うが、濃度が等しくなるとは限らない。",
                },
                {
                    "target_text": "温度を上げると発熱方向に進む",
                    "correct_text": "温度を上げると吸熱方向に進む",
                    "explanation": "ル・シャトリエの原理は摂動を緩和する方向。温度上昇は吸熱で吸収する。",
                },
            ],
        },
    },
    "鎌倉幕府の成立": {
        "correct": {
            "content": (
                "1185 年に源頼朝が守護・地頭の設置を朝廷に認めさせ、実質的な鎌倉幕府の成立とされる。"
                "1192 年に頼朝が征夷大将軍に任命された。"
                "御家人と将軍は御恩と奉公の主従関係で結ばれた。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "1192 年に源頼朝が征夷大将軍に任命され、鎌倉幕府が成立した。"
                "御家人と将軍の関係は租庸調による主従関係であった。"
            ),
            "corrections": [
                {
                    "target_text": "租庸調による主従関係",
                    "correct_text": "御恩と奉公による主従関係",
                    "explanation": "租庸調は律令制の税制度。鎌倉時代の主従関係は御恩と奉公。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "1192 年に平清盛が征夷大将軍となり、鎌倉幕府が成立した。"
                "幕府は御家人を律令制度のもとで統治した。"
            ),
            "corrections": [
                {
                    "target_text": "平清盛が征夷大将軍",
                    "correct_text": "源頼朝が征夷大将軍",
                    "explanation": "鎌倉幕府を開いたのは源頼朝。平清盛は平氏政権の中心人物。",
                },
                {
                    "target_text": "御家人を律令制度のもとで統治した",
                    "correct_text": "御家人を御恩と奉公の主従関係で統治した",
                    "explanation": "鎌倉時代は律令制度ではなく封建的主従関係 (御恩と奉公) で統治した。",
                },
            ],
        },
    },
    "江戸時代の三大改革": {
        "correct": {
            "content": (
                "享保の改革 (徳川吉宗・1716-)、寛政の改革 (松平定信・1787-)、"
                "天保の改革 (水野忠邦・1841-) を江戸三大改革と呼ぶ。"
                "倹約令や上米の制、棄捐令などで幕府財政の立て直しを図った。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "享保の改革は徳川吉宗、寛政の改革は田沼意次、天保の改革は水野忠邦が行った。"
            ),
            "corrections": [
                {
                    "target_text": "寛政の改革は田沼意次",
                    "correct_text": "寛政の改革は松平定信",
                    "explanation": "田沼意次は寛政の改革ではなく、田沼時代 (重商主義政策) の人物。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "享保の改革は徳川家光、寛政の改革は徳川吉宗、天保の改革は田沼意次が行った。"
            ),
            "corrections": [
                {
                    "target_text": "享保の改革は徳川家光",
                    "correct_text": "享保の改革は徳川吉宗",
                    "explanation": "徳川家光は 3 代将軍。享保の改革は 8 代将軍吉宗。",
                },
                {
                    "target_text": "寛政の改革は徳川吉宗、天保の改革は田沼意次",
                    "correct_text": "寛政は松平定信、天保は水野忠邦",
                    "explanation": "改革と改革者の対応が完全に混乱している。",
                },
            ],
        },
    },
    "明治維新": {
        "correct": {
            "content": (
                "1867 年大政奉還、1868 年王政復古の大号令から戊辰戦争を経て新政府が発足。"
                "版籍奉還 (1869)、廃藩置県 (1871) で中央集権化、四民平等を進めた。"
                "富国強兵・殖産興業をスローガンに近代化を推進した。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "1867 年に大政奉還、1868 年に王政復古の大号令が出された。"
                "1869 年に廃藩置県、1871 年に版籍奉還が行われ、中央集権化が進んだ。"
            ),
            "corrections": [
                {
                    "target_text": "1869 年に廃藩置県、1871 年に版籍奉還",
                    "correct_text": "1869 年に版籍奉還、1871 年に廃藩置県",
                    "explanation": "順序が逆。版籍奉還が先で、その 2 年後に廃藩置県を断行した。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "1868 年に大政奉還、1867 年に王政復古の大号令が出された。"
                "明治政府のスローガンは尊王攘夷であった。"
            ),
            "corrections": [
                {
                    "target_text": "1868 年に大政奉還、1867 年に王政復古の大号令",
                    "correct_text": "1867 年に大政奉還、1868 年に王政復古の大号令",
                    "explanation": "年が逆。大政奉還が先で、翌年に王政復古の大号令。",
                },
                {
                    "target_text": "明治政府のスローガンは尊王攘夷",
                    "correct_text": "明治政府のスローガンは富国強兵・殖産興業",
                    "explanation": "尊王攘夷は幕末の倒幕派の標語。明治政府は近代化路線。",
                },
            ],
        },
    },
    "戦後の高度経済成長": {
        "correct": {
            "content": (
                "1955 年頃から 1973 年のオイルショックまで、日本は年平均 10% 前後の経済成長を続けた。"
                "三種の神器 (白黒テレビ・冷蔵庫・洗濯機)、新三種の神器 (3C: カラーテレビ・クーラー・カー) が普及。"
                "1964 年東京オリンピック、1970 年大阪万博が高度経済成長の象徴。"
            ),
            "corrections": [],
        },
        "partial": {
            "content": (
                "高度経済成長期は 1955 年頃から始まり、1973 年のオイルショックで終わった。"
                "三種の神器はカラーテレビ・クーラー・カーを指す。"
            ),
            "corrections": [
                {
                    "target_text": "三種の神器はカラーテレビ・クーラー・カー",
                    "correct_text": "三種の神器は白黒テレビ・冷蔵庫・洗濯機",
                    "explanation": "3C は新三種の神器。古い三種の神器は白黒テレビ・冷蔵庫・洗濯機。",
                }
            ],
        },
        "incorrect": {
            "content": (
                "高度経済成長は 1973 年のオイルショックから始まり 1990 年のバブル崩壊で終わった。"
                "東京オリンピックは 1980 年に開催された。"
            ),
            "corrections": [
                {
                    "target_text": "1973 年のオイルショックから始まり 1990 年のバブル崩壊で終わった",
                    "correct_text": "1955 年頃から始まり 1973 年のオイルショックで終わった",
                    "explanation": "オイルショックは始期ではなく終期。期間も全く異なる。",
                },
                {
                    "target_text": "東京オリンピックは 1980 年",
                    "correct_text": "東京オリンピックは 1964 年",
                    "explanation": "戦後初の東京オリンピックは 1964 年。",
                },
            ],
        },
    },
}

# verdict 別の score 範囲と advice テンプレ
SCORE_RANGES: dict[str, tuple[int, int]] = {
    "correct": (88, 100),
    "partial": (65, 82),
    "incorrect": (35, 55),
}

ADVICE_TEMPLATES: dict[str, list[str]] = {
    "correct": [
        "素晴らしい！要点を正確に押さえています。次はもう一段難しい問題に挑戦しましょう。",
        "完璧な理解です。応用問題でも同じ精度を保てるよう、典型問題を周回するのがおすすめ。",
        "全項目正解。この単元は身についています。関連単元との接続を意識すると更に伸びます。",
    ],
    "partial": [
        "概ね正しい理解ですが、用語や符号を取り違えている箇所があります。教科書の定義を 1 度見直しましょう。",
        "方向性は正しいので、ケアレスミスを減らせばすぐに正答に届きます。声に出して説明する練習が効きます。",
        "主要点は理解できています。細部の定義を曖昧にせず、自分の言葉で書き直してみると定着します。",
    ],
    "incorrect": [
        "基礎概念の取り違えがあります。教科書の該当章を冒頭から読み直し、用語の定義をノートに整理しましょう。",
        "重要な定義が複数間違っているので、一度典型例題を解き直して、解答プロセスを言語化するのがおすすめ。",
        "焦らず基礎から再構築しましょう。理解が曖昧なまま暗記するより、図やグラフで視覚化すると伸びます。",
    ],
}

# verdict の比率 (合計 = 1 セッション数で 90 件をぴったり割る)
VERDICT_DISTRIBUTION: list[tuple[str, float]] = [
    ("correct", 0.60),
    ("partial", 0.30),
    ("incorrect", 0.10),
]

# 1 日の開始時刻 (JST)
DAILY_START_HOURS: list[int] = [9, 13, 19]


# ───────────────────────────────────────────────────────────
# データ生成
# ───────────────────────────────────────────────────────────


@dataclass
class PlannedRow:
    session_id: UUID
    started_at: datetime
    completed_at: datetime
    submitted_at: datetime
    judged_at: datetime
    subject: str
    topic: str
    output_id: UUID
    output_content: str
    verdict: str
    score: int
    advice: str
    corrections: list[dict[str, str]]
    judgment_id: UUID


def build_verdict_sequence(total: int, rng: random.Random) -> list[str]:
    """合計 total 件の verdict 列を比率どおりに作って shuffle する。"""
    sequence: list[str] = []
    remaining = total
    for verdict, ratio in VERDICT_DISTRIBUTION[:-1]:
        count = int(round(total * ratio))
        sequence.extend([verdict] * count)
        remaining -= count
    # 端数は最後の verdict (incorrect) に寄せる。
    sequence.extend([VERDICT_DISTRIBUTION[-1][0]] * remaining)
    rng.shuffle(sequence)
    return sequence


def plan_rows(*, days: int, base_date: datetime, rng: random.Random) -> list[PlannedRow]:
    """sessions/outputs/judgments 全 90 件のデータを計画する。"""
    total_sessions = days * len(DAILY_START_HOURS)
    verdict_sequence = build_verdict_sequence(total_sessions, rng)

    advice_cycle = {
        verdict: list(ADVICE_TEMPLATES[verdict]) for verdict in ADVICE_TEMPLATES
    }
    advice_cursor = {verdict: 0 for verdict in ADVICE_TEMPLATES}

    planned: list[PlannedRow] = []
    for day_offset in range(days):
        date = base_date - timedelta(days=days - day_offset)
        for slot_index, hour in enumerate(DAILY_START_HOURS):
            global_index = day_offset * len(DAILY_START_HOURS) + slot_index
            topic_spec = TOPICS[global_index % len(TOPICS)]
            verdict = verdict_sequence[global_index]
            content_spec = CONTENT_BY_TOPIC[topic_spec.topic][verdict]

            score_min, score_max = SCORE_RANGES[verdict]
            score = rng.randint(score_min, score_max)

            advice_index = advice_cursor[verdict] % len(advice_cycle[verdict])
            advice_cursor[verdict] += 1
            advice = advice_cycle[verdict][advice_index]

            started_at = date.replace(
                hour=hour, minute=0, second=0, microsecond=0
            )
            completed_at = started_at + timedelta(minutes=30)
            submitted_at = started_at + timedelta(minutes=25)
            judged_at = submitted_at + timedelta(seconds=15)

            planned.append(
                PlannedRow(
                    session_id=uuid4(),
                    started_at=started_at,
                    completed_at=completed_at,
                    submitted_at=submitted_at,
                    judged_at=judged_at,
                    subject=topic_spec.subject,
                    topic=topic_spec.topic,
                    output_id=uuid4(),
                    output_content=str(content_spec["content"]),
                    verdict=verdict,
                    score=score,
                    advice=advice,
                    corrections=list(content_spec["corrections"]),  # type: ignore[arg-type]
                    judgment_id=uuid4(),
                )
            )

    return planned


# ───────────────────────────────────────────────────────────
# DB 投入
# ───────────────────────────────────────────────────────────


async def fetch_user_id_by_firebase_uid(session: AsyncSession, firebase_uid: str) -> UUID:
    stmt = select(UserModel.id).where(UserModel.firebase_uid == firebase_uid)
    result = await session.execute(stmt)
    user_id = result.scalar_one_or_none()
    if user_id is None:
        raise RuntimeError(f"user not found for firebase_uid={firebase_uid}")
    return user_id


async def ensure_subjects(
    session: AsyncSession, *, user_id: UUID
) -> dict[str, UUID]:
    """user_subjects に label が無ければ INSERT、ある label は再利用する。"""
    stmt = select(StudySubjectModel).where(StudySubjectModel.user_id == user_id)
    existing = {row.label: row.id for row in (await session.scalars(stmt)).all()}

    label_to_id: dict[str, UUID] = {}
    for label, color in SUBJECT_COLORS.items():
        if label in existing:
            label_to_id[label] = existing[label]
            continue
        new_id = uuid4()
        session.add(StudySubjectModel(id=new_id, user_id=user_id, label=label, color=color))
        label_to_id[label] = new_id

    return label_to_id


async def insert_planned_rows(
    session: AsyncSession,
    *,
    user_id: UUID,
    rows: list[PlannedRow],
    label_to_id: dict[str, UUID],
) -> None:
    # ORM に relationship を定義していないため、SQLAlchemy は FK 依存を解決できない。
    # sessions → outputs → (judgments / output_subject_assignments) の順で
    # 段階的に flush して FK 違反を防ぐ。
    for row in rows:
        session.add(
            SessionModel(
                id=row.session_id,
                user_id=user_id,
                status="judged",
                subject=row.subject,
                topic=row.topic,
                input_minutes=20,
                output_minutes=5,
                break_minutes=5,
                started_at=row.started_at,
                completed_at=row.completed_at,
            )
        )
    await session.flush()

    for row in rows:
        session.add(
            OutputModel(
                id=row.output_id,
                session_id=row.session_id,
                kind="text",
                content=row.output_content,
                image_storage_path=None,
                submitted_at=row.submitted_at,
            )
        )
    await session.flush()

    for row in rows:
        session.add(
            JudgmentModel(
                id=row.judgment_id,
                session_id=row.session_id,
                verdict=row.verdict,
                score=row.score,
                advice=row.advice,
                corrections=row.corrections,
                judged_at=row.judged_at,
            )
        )
        session.add(
            OutputSubjectAssignmentModel(
                output_id=row.output_id,
                subject_id=label_to_id[row.subject],
            )
        )
    await session.flush()


# ───────────────────────────────────────────────────────────
# メイン
# ───────────────────────────────────────────────────────────


async def main_async(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    base_date = datetime.now(JST).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = plan_rows(days=args.days, base_date=base_date, rng=rng)

    print_summary(rows)

    if not args.apply:
        print("\n--apply が無いため dry-run で終了します。実投入する場合は --apply を付けて再実行してください。")
        return

    engine = create_async_engine(args.db_url, future=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        async with session.begin():
            user_id = await fetch_user_id_by_firebase_uid(session, args.user_uid)
            label_to_id = await ensure_subjects(session, user_id=user_id)
            await insert_planned_rows(
                session, user_id=user_id, rows=rows, label_to_id=label_to_id
            )
        print(
            f"\n投入完了: user_id={user_id} sessions={len(rows)} subjects={len(label_to_id)}"
        )

    await engine.dispose()


def print_summary(rows: list[PlannedRow]) -> None:
    print(f"=== 投入予定 (合計 {len(rows)} セッション) ===\n")
    counts: dict[str, int] = {}
    subject_counts: dict[str, int] = {}
    for row in rows:
        counts[row.verdict] = counts.get(row.verdict, 0) + 1
        subject_counts[row.subject] = subject_counts.get(row.subject, 0) + 1

    print("verdict 比率:")
    for verdict, count in counts.items():
        print(f"  {verdict:10s} {count:3d} 件 ({count / len(rows) * 100:.1f}%)")

    print("\nsubject 比率:")
    for subject, count in subject_counts.items():
        print(f"  {subject:6s} {count:3d} 件")

    print("\n先頭 6 件のサンプル:")
    for row in rows[:6]:
        print(
            f"  {row.started_at.strftime('%Y-%m-%d %H:%M JST')}  "
            f"{row.subject:4s} / {row.topic:18s}  "
            f"verdict={row.verdict:9s} score={row.score:3d}"
        )
    print("\n末尾 3 件のサンプル:")
    for row in rows[-3:]:
        print(
            f"  {row.started_at.strftime('%Y-%m-%d %H:%M JST')}  "
            f"{row.subject:4s} / {row.topic:18s}  "
            f"verdict={row.verdict:9s} score={row.score:3d}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db-url",
        required=False,
        help="SQLAlchemy 用の DATABASE_URL (例: postgresql+asyncpg://hourglass:pass@localhost:5433/hourglass)",
    )
    parser.add_argument(
        "--user-uid",
        required=True,
        help="対象ユーザーの Firebase UID",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="投入する日数 (デフォルト 30)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="疑似乱数 seed (デフォルト 42)。同じ seed なら同じデータが生成される。",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="実際に DB へ投入する。指定しなければ dry-run。",
    )
    args = parser.parse_args()
    if args.apply and not args.db_url:
        parser.error("--apply を指定する場合は --db-url が必須です。")
    return args


if __name__ == "__main__":
    asyncio.run(main_async(parse_args()))

### 1. システムアーキテクチャ

#### 1.1. アーキテクチャ概要

```markdown
[Client Layer]
  React Native (Expo) + TypeScript
  iOS / Android
      |
      | HTTPS (REST API + Firebase Auth Token)
      |
[Application Layer]
  Cloud Run (FastAPI / Python)
      |--- Firebase Admin SDK (認証トークン検証)
      |--- LLM API Client (正誤判定)
      |--- Cloud Tasks (非同期ジョブ)
      |
[Data Layer]
  Cloud SQL (PostgreSQL 15)
  Cloud Storage
```

#### 1.2. データフロー

1. インプット
2. アウトプット
3. 休憩
4. 結果確認

#### 1.3. コンポーネント構成図

| **コンポーネント** | **サービス** | **役割** |
| --- | --- | --- |
| クライアント | React Native (Expo) | UI・タイマー・ローカル状態管理 |
| 認証 | Firebase Authentication | Apple/Googleサインイン・トークン発行 |
| APIサーバー | Cloud Run + FastAPI | REST API・ビジネスロジック |
| 非同期処理 | Cloud Tasks | LLM判定ジョブのキューイング |
| データベース | Cloud SQL (PostgreSQL 15) | ユーザ・セッション・判定データ |
| プッシュ通知 | Firebase Cloud Messaging | フェーズ切替・判定完了通知 |
| シークレット管理 | Secret Manager | LLM APIキー等の機密情報 |
| 監視 | Cloud Logging + Cloud Monitoring | ログ収集・アラート・ダッシュボード |
| IaC | Terraform | インフラのコード管理 |

### 2. 技術スタックと選定理由

#### 2.1. フロントエンド

| **項目** | **選定** | **理由** |
| --- | --- | --- |
| フレームワーク | React Native (Expo SDK) | TypeScript 対応・ iOS / Android ネイティビルド・ OTA アップデート・豊富なエコシステム |
| 言語 | TypeScript | 型安全性によるバグ抑止・開発体験向上 |
| 状態管理 | Zustand | 軽量・シンプル・ボイラープレート最小。タイマー状態管理に最適 |
| API通信 | TanStack Query (React Query) | キャッシュ・再試行・ポーリングを宣言的に管理 |
| HTTPクライアント | Fetch API + 共通ラッパー | Authorization ヘッダーへ認証トークンを自動付与 |
| ナビゲーション | Expo Router | ファイルベースルーティング・ Next.js ライクな直感的設計 |
| フォーム | React Hook Form + Zod | バリデーションと型安全性の両立 |
| UIコンポーネント | Tamagui | ネイティブパフォーマンス・テーマ対応・ダークモード対応 |
| テスト | Jest + React Native Testing Library | ユニットテスト・コンポーネントテスト |
| リント | ESLint + Prettier | コード品質維持 |

#### 2.2. バックエンド

| **項目** | **選定** | **理由** |
| --- | --- | --- |
| 言語 | Python | 型ヒント・パフォーマンス改善・ LLM SDK のエコシステムが最も充実 |
| フレームワーク | FastAPI | 非同期対応・自動 OpenAPI 生成・型バリデーション |
| ORM | SQLAlchemy + Alembic | 非同期 ORM・型安全クエリ・マイグレーション管理 |
| バリデーション | Pydantic | APIリクエスト/レスポンスの型検証・ LLMレスポンスパース |
| 認証 | Firebase Admin SDK | トークン検証・ユーザ管理 |
| テスト | pytest + pytest-asyncio + httpx | 非同朚APIテスト・カバレッジ計測 |
| リント/フォーマット | Ruff | 高速リント・フォーマット統合ツール |
| パッケージ管理 | uv | 高速な依存解決・ロックファイル対応 |

#### 2.3. インフラストラクチャ

| **項目** | **選定** | **理由** |
| --- | --- | --- |
| コンピュート | Cloud Run | サーバーレス・自動スケーリング・コスト効率が高い |
| DB | Cloud SQL  | マネージド・自動バックアップ・高可用性 |
| 認証基盤 | Firebase Authentication | Apple / Google サインインの実装が最も簡単・無料枚 |
| 非同期キュー | Cloud Tasks | LLM 判定の非同期実行・リトライ・タイムアウト制御 |
| プッシュ通知 | Firebase Cloud Messaging | iOS / Android クロスプラットフォーム対応 |
| コンテナレジストリ | Artifact Registry | Docker イメージ管理 |
| IaC | Terraform | インフラの再現性・バージョン管理 |
| CI/CD | GitHub Actions | GitHub統合・豊富なアクションエコシステム |

#### 2.4. 技術スタック選定における比較検討

**Google Cloud vs AWS**

| **観点** | **Google Cloud** | **AWS** |
| --- | --- | --- |
| 認証 | Firebase Auth が Apple / Google サインインを即対応 | Cognito は設定が複雑 |
| コンピュート | Cloud Run: Dockerfile だけでデプロイ | ECS / Fargate: VPC / ALB 等の設定が必要 |
| プッシュ通知 | FCM が無料で iOS / Android 対応 | SNS + Pinpoint で複数サービスが必要 |
| Gemini親和性 | Vertex AI でシームレス | Bedrock経由で可能だが間接的 |
| 結論 | ○ 採用 | × 本プロダクトではオーバースペック |

### 3. API 設計

#### 3.1. 設計方針

- RESTful API・バージョニング付き（/api/v1/）
- リクエスト / レスポンスは Pydantic モデルで型定義
- OpenAPI 3.1仕様を自動生成
- エラーレスポンスは RFC 7807 Problem Details 準拠
- 認証が Required のエンドポイントは Authorization: Bearer <Firebase ID Token> を要求

### 3.2. エンドポイント一覧

**3.2.1. 認証**

| **Method** | **Path** | **概要** | **認証** | **レスポンス概要** |
| --- | --- | --- | --- | --- |
| POST | /api/v1/auth/verify | Firebase ID Token を検証し、未登録 UID なら users を自動作成する | 必須 | { user, is_new } |

認証が必要な他の endpoint では `auth_middleware` が `Authorization: Bearer <Firebase ID Token>` を検証し、未登録ユーザーなら backend 側で初期作成する。`/auth/verify` は mobile 側のサインイン直後にユーザー登録を確実にするための明示的な呼び出し口で、`is_new` により初回登録かどうかをクライアントに伝える。

**3.2.2. セッション管理**

| **Method** | **Path** | **概要** | **認証** | **レスポンス概要** |
| --- | --- | --- | --- | --- |
| POST | /api/v1/sessions | 新規セッション作成 | 必須 | { session } |
| PATCH | /api/v1/sessions/{id} | セッションステータス更新 | 必須 | { session } |
| GET | /api/v1/sessions/outputs/today | 今日のアウトプット一覧取得 | 必須 | { items[] } |

**3.2.3. アウトプット・判定**

| **Method** | **Path** | **概要** | **認証** | **レスポンス概要** |
| --- | --- | --- | --- | --- |
| POST | /api/v1/sessions/{id}/output | アウトプットテキスト送信。セッションを judging に進め、開発環境ではローカル判定も可能 | 必須 | { output, status } |
| GET | /api/v1/sessions/{id}/judgment | 判定結果取得。未完了なら202を返却 | 必須 | { judgment } or 202 |

**3.2.4. 判定履歴（予定）**

以下は mobile 側 API client が先行している。backend の router は現時点では未登録。

| **Method** | **Path** | **概要** | **認証** | **レスポンス概要** |
| --- | --- | --- | --- | --- |
| GET | /api/v1/judgments | 判定履歴一覧（フィルタ・ソート・ページネーション） | 必須 | { judgments[], next_cursor } |
| GET | /api/v1/judgments/{id} | 判定詳細取得 | 必須 | { judgment } |

**3.2.5. 統計（予定）**

以下は mobile 側 API client が先行している。backend の router は現時点では未登録。

| **Method** | **Path** | **概要** | **認証** | **レスポンス概要** |
| --- | --- | --- | --- | --- |
| GET | /api/v1/stats/summary | 統計サマリ | 必須 | { stats } |
| GET | /api/v1/stats/daily | 日別統計 | 必須 | { daily_stats[] } |
| GET | /api/v1/stats/weekly | 週別統計 | 必須 | { daily_stats[] } |
| GET | /api/v1/stats/monthly | 月別統計 | 必須 | { daily_stats[] } |

**3.2.6. ユーザ設定**

| **Method** | **Path** | **概要** | **認証** | **レスポンス概要** |
| --- | --- | --- | --- | --- |
| GET | /api/v1/users/me/profile | 自分のプロフィール取得 | 必須 | { user } |
| PATCH | /api/v1/users/me/profile | 自分のプロフィール更新 | 必須 | { user } |
| GET | /api/v1/users/me/settings | タイマー / 通知設定取得 | 必須 | { settings } |
| PATCH | /api/v1/users/me/settings | タイマー設定変更（時間カスタマイズ） | 必須 | { settings } |
| DELETE | /api/v1/users/me | アカウント削除（GDPR/個人情報保護法対応） | 必須 | 204 No Content |

#### 3.2.7 ヘルスチェック

| **Method** | **Path** | **概要** | **認証** | **レスポンス概要** |
| --- | --- | --- | --- | --- |
| GET | /health | サーバー死活確認 | 不要 | { status: ok } |
| GET | /health/ready | DB接続含む準備完了確認 | 不要 | { status, db } |

#### 3.3. 主要リクエスト / レスポンススキーマ

**3.3.0. 認証検証レスポンス**

POST `/api/v1/auth/verify`（リクエストボディは空、`Authorization: Bearer <Firebase ID Token>` を必須とする）

```basic
{
  "user": {
    "id": "5c3aeb42-7c3f-4e06-8d27-8a9b13a2f1b5",
    "firebase_uid": "firebase-uid-xxxx",
    "auth_provider": "apple",
    "display_name": null,
    "age_group": null,
    "onboarding_completed": false,
    "created_at": "2026-04-25T09:12:00+00:00",
    "updated_at": "2026-04-25T09:12:00+00:00"
  },
  "is_new": true
}
```

**3.3.1. セッション作成リクエスト**

POST `/api/v1/sessions`

```basic
{
  "subject": "英語",
  "topic": "関係代名詞",
  "input_minutes": 20,
  "output_minutes": 5,
  "break_minutes": 5
}
```

**3.3.2. アウトプット送信リクエスト**

POST `/api/v1/sessions/{id}/output`

```basic
{
	"content": "関係代名詞は先行詞を修飾する...",
	"submitted_at": "2026-04-10T15:25:00+09:00"
}
```

**3.3.3. 判定結果レスポンス**

GET `/api/v1/sessions/{id}/judgment`

```basic
{
  "id": "2b90f7d2-0e7f-4a5f-a5be-7f92c2a4b865",
  "session_id": "0f7c5c61-8b2d-4a8c-a1df-6d79b9b6e8a8",
  "verdict": "partial",
  "score": 70,
  "advice": "全体的に良く理解できています。...",
  "corrections": [
    {
      "target_text": "whoは人以外にも使える",
      "correct_text": "whoは人に対して使い、人以外には which を使う",
      "explanation": "who は人を表す先行詞に使います。"
    }
  ],
  "judged_at": "2026-04-10T15:30:15+09:00"
}
```

#### 3.4. エラーレスポンス形式

```basic
{
  "type": "validation_error",
  "title": "Validation Error",
  "status": 422,
  "detail": "output content must not be empty",
  "instance": "/api/v1/sessions/ses_xxxx/output"
}
```

#### 3.5. レートリミット

| **対象** | **制限値** | **備考** |
| --- | --- | --- |
| 認証エンドポイント | 10回 / 分 | ブルートフォース防止 |
| セッション作成 | 30回 / 時 | 異常利用検知用の安全弁 |
| LLM判定リクエスト | 20回 / 時 | LLM API コスト保護 |
| その他API | 60回 / 分 | 一般的な保護 |

### 4. データベース設計

#### 4.1. 設計方針

- PostgreSQL を使用。JSONB 型を活用し、LLM レスポンスの柔軟な保存を実現
- UUID を主キーに使用
- 論理削除を採用し、deleted_at カラムで管理
- タイムスタンプは全て JST で保存、クライアント側でローカルタイムに変換
- マイグレーションは Alembic で管理

#### 4.2. ER 図

```mermaid
users ||--o{ sessions : "作成"
users ||--|| user_settings : "設定"
sessions ||--o| outputs : "アウトプット"
sessions ||--o| judgments : "判定"
outputs ||--|| judgments : "対象"
```

#### 4.3. テーブル定義

**4.3.1. users**

ユーザ情報。Firebase Auth の UID と紐付け

| **カラム名** | **型** | **NULL** | **説明** |
| --- | --- | --- | --- |
| id | UUID PK | NO | 内部ユーザ ID |
| firebase_uid | VARCHAR UNIQUE | NO | Firebase Auth のUID |
| display_name | VARCHAR | YES | 表示名 |
| auth_provider | VARCHAR | NO | apple / google |
| fcm_token | TEXT | YES | Firebase Cloud Messaging トークン |
| created_at | TIMESTAMPTZ | NO | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | 論理削除日時 |

**4.3.2. user_settings**

ユーザごとのタイマー設定

| **カラム名** | **型** | **NULL** | **説明** |
| --- | --- | --- | --- |
| id | UUID (v7) PK | NO | 設定 ID |
| user_id | UUID FK -> users | NO | ユーザ ID |
| input_minutes | INTEGER DEFAULT 20 | NO | インプット時間（分） |
| output_minutes | INTEGER DEFAULT 5 | NO | アウトプット時間（分） |
| break_minutes | INTEGER DEFAULT 5 | NO | 休憩時間（分） |
| notification_enabled | BOOLEAN DEFAULT true | NO | プッシュ通知の有無 |
| created_at | TIMESTAMPTZ | NO | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | 更新日時 |

**4.3.3. sessions**

ポモドーロセッション。インプット→アウトプット→判定の1サイクル

| **カラム名** | **型** | **NULL** | **説明** |
| --- | --- | --- | --- |
| id | UUID PK | NO | セッション ID |
| user_id | UUID FK -> users | NO | ユーザ ID |
| status | VARCHAR(16) | NO | input / output / judging / judged / cancelled |
| subject | VARCHAR(50) | NO | 学習科目（例: 英語）。 |
| topic | VARCHAR(200) | NO | 学習トピック（例: 関係代名詞）。 |
| input_minutes | INTEGER | NO | 実際のインプット時間 |
| output_minutes | INTEGER | NO | 実際のアウトプット時間 |
| break_minutes | INTEGER | NO | 実際の休憩時間 |
| started_at | TIMESTAMPTZ | NO | セッション開始日時 |
| completed_at | TIMESTAMPTZ | YES | セッション完了日時 |
| created_at | TIMESTAMPTZ | NO | 作成日時 |

**4.3.4. outputs**

ユーザのアウトプット内容

| **カラム名** | **型** | **NULL** | **説明** |
| --- | --- | --- | --- |
| id | UUID PK | NO | アウトプット ID |
| session_id | UUID FK -> sessions UNIQUE | NO | セッション ID |
| content | TEXT | NO | アウトプットテキスト本文 |
| submitted_at | TIMESTAMPTZ | NO | 送信日時 |
| created_at | TIMESTAMPTZ | NO | 作成日時 |

**4.3.5. judgments**

LLM による正誤判定結果

| **カラム名** | **型** | **NULL** | **説明** |
| --- | --- | --- | --- |
| id | UUID PK | NO | 判定ID |
| session_id | UUID FK -> sessions UNIQUE | NO | セッションID |
| verdict | VARCHAR(16) | NO | correct / partial / incorrect / rejected |
| score | INTEGER | NO | スコア（0-100） |
| advice | TEXT | NO | 総合アドバイス |
| corrections | JSONB | NO | 誤り指摘配列（target_text / correct_text / explanation） |
| judged_at | TIMESTAMPTZ | NO | 判定実行日時 |

**4.3.6. rate_limit_logs**

レートリミット監視用ログ

| **カラム名** | **型** | **NULL** | **説明** |
| --- | --- | --- | --- |
| id | BIGSERIAL PK | NO | ログID |
| user_id | UUID FK -> users | NO | ユーザID |
| endpoint | VARCHAR(100) | NO | アクセス先エンドポイント |
| was_limited | BOOLEAN | NO | 制限が適用されたか |
| created_at | TIMESTAMPTZ | NO | アクセス日時 |

### 5. プロンプト設計

#### 5.1. 設計方針

- プロンプトはバージョン管理し、A/B テスト可能な構造とする
- 出力は必ず JSON 形式を強制し、Pydantic モデルでバリデーション
- ハルシネーション対策として、「不明な場合は『判定不能』とする」指示を含める
- 学習者のレベルに合わせたフィードバック
    - ユーザ登録の際の年齢を反映させる
- 不適切な入力を検知し、判定を拒否するガードレール

#### 5.2. システムプロンプト（例）

```python
あなたは学習支援AIです。ユーザーが学習した内容をアウトプットしました。
以下の[## ルール]に従って正誤判定を行ってください。

## ルール
1. ユーザーのアウトプットを主張単位に分解し、それぞれの正誤を判定
2. 各主張に対して具体的なフィードバックを提供
3. 不明な場合は「判定不能」とし、推測で正解/不正解を出さない
4. フィードバックは高校生にわかる平易な日本語で書く
5. 学習と無関係な内容の場合は判定を拒否する

## 入力情報
科目: {subject}
トピック: {topic}
アウトプット内容: {content}

## 出力形式
以下のJSON形式でのみ応答してください。JSON以外の文字列は出力しないでください。
{
  "verdict": "correct" | "partial" | "incorrect" | "rejected",
  "score": 0-100,
  "advice": "総合アドバイス",
  "corrections": [
    {
      "target_text": "誤りを含む本文中の抜粋",
      "correct_text": "正しい内容",
      "explanation": "誤りの理由"
    }
  ]
}
```

#### 5.3. Pydantic バリデーション

```python
class JudgmentCorrection(BaseModel):
    target_text: str
    correct_text: str
    explanation: str

class LLMJudgmentResponse(BaseModel):
    verdict: Literal["correct","partial","incorrect","rejected"]
    score: int = Field(ge=0, le=100)
    advice: str = Field(max_length=1000)
    corrections: list[JudgmentCorrection]
```

#### 5.4. LLM プロバイダー抽象化

プロバイダー切り替えを容易にするために、以下のインターフェースを定義する。

```python
class BaseLLMProvider(ABC):
    @abstractmethod
    async def judge(
        self, subject: str, topic: str, content: str
    ) -> LLMJudgmentResponse: ...

class GeminiProvider(BaseLLMProvider): ...
class OpenAIProvider(BaseLLMProvider): ...
class AnthropicProvider(BaseLLMProvider): ...
```

#### 5.5. エラーハンドリング

| **ケース** | **対処** |
| --- | --- |
| LLM APIタイムアウト | 最大3回リトライ（指数バックオフ）。失敗時はフォールバックプロバイダーに切り替え |
| JSONパース失敗 | 1回リトライ。再度失敗時は「判定できませんでした」をユーザに返却 |
| レートリミット | キューに戻してリトライ。ユーザには「少々お待ちください」と表示 |
| 不適切入力検知 | LLMがrejectedを返却。ユーザに「学習内容を入力してください」と表示 |

### 6. 認証・ユーザ管理

#### 6.1. 認証フロー

1. クライアント: Firebase SDK で Apple / Google サインイン実行
2. クライアント: Firebase ID Token を取得
3. クライアント: Authorization: Bearer <token> でAPIリクエスト
4. サーバー: Firebase Admin SDK でトークン検証
5. サーバー: firebase_uid で内部 users テーブルを検索
6. サーバー: 未登録なら自動でユーザレコード作成

#### 6.2. トークン検証 middleware

```python
async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = authorization.replace('Bearer ', '')
    decoded = firebase_admin.auth.verify_id_token(token)
    user = await user_repo.get_by_firebase_uid(db, decoded['uid'])
    if not user:
        user = await user_repo.create(db, decoded)
    return user
```

#### 6.3. クライアント側の実装

Expoでは expo-auth-session および @react-native-firebase/auth を使用する。

- Apple Sign In: expo-apple-authentication の signInAsync() を使用
- Google Sign In: @react-native-google-signin/google-signin を使用
- 取得した credential を Firebase Auth に渡し、ID Token を取得
- ID Token は共通 HTTP クライアントで全 API リクエストの Authorization ヘッダーへ自動付与
- トークン期限切れ時は自動リフレッシュ（Firebase SDK が自動処理）

#### 6.4. アカウント削除

App Storeガイドラインおよび個人情報保護法に準拠し、アカウント削除機能を必ず提供する。

- クライアントから DELETE /api/v1/users/me を呼び出し
- サーバー側で論理削除（deleted_at をセット）
- 30日後にバッチジョブで物理削除（Firebase Auth のユーザも削除）

### 7. CI/CD・デプロイ構成

#### 7.1. 環境構成

| **環境** | **用途** | **デプロイトリガー** |
| --- | --- | --- |
| development | ローカル開発 | 手動 |
| staging | 統合テスト・ QA | develop ブランチへの merge |
| production | 本番 | main ブランチへの merge + 手動承認 |

#### 7.2. Github Actions パイプライン

**7.2.1. バックエンド CI**

トリガー：全ブランチへの push および PR

1. Ruff によるリント・フォーマットチェック
2. ty による型チェック
3. pytest 実行
4. Docker ビルド確認

**7.2.2. フロントエンド CI**

トリガー：全ブランチへの push および PR

1. ESLint + Prettier によるリント・フォーマットチェック
2. TypeScript コンパイルチェック（tsc --noEmit）
3. Jest テスト実行
4. Expo Doctor による依存関係チェック

**7.2.3. バックエンド CD**

トリガー：main / develop ブランチへのマージ

1. Docker イメージビルド
2. Artifact Registry へ push
3. Cloud Run へデプロイ（トラフィック分割でカナリアリリース）
4. Alembic マイグレーション実行
5. E2E スモークテスト

**7.2.4. モバイルアプリ CD**

トリガー：手動実行（workflow_dispatch）

1. EAS Build で iOS / Android ビルド
2. EAS Submit で App Store Connect / Google Play Console へアップロード
3. OTA アップデートは EAS Update でネイティブ変更不要の場合に使用

#### 7.3. インフラ構成

以下のリソースをTerraformで管理する。

- Google Cloud プロジェクト・ API有効化
- Cloud Run サービス
- Cloud SQL インスタンス
- Cloud Tasks キュー
- Secret Manager シークレット
- Artifact Registry リポジトリ
- IAM サービスアカウント・ロールバインディング
- Workload Identity Federation（GitHub Actions 用 OIDC 認証）

#### Docker 構成

```docker
FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv==0.10.2
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim AS runner
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY src/ src/
COPY db/ db/
COPY alembic.ini ./
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
EXPOSE 8080
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 8. ディレクトリ構成

#### 8.1. リポジトリ構成

```markdown
puttokei/
├── .github/
│   └── workflows/
│       ├── backend-ci.yaml
│       ├── backend-cd.yaml
│       ├── mobile-ci.yaml
│       └── mobile-cd.yaml
├── backend/
├── mobile/
├── docs/
├── AGENTS.md
├── CLAUDE.md
├── README
├── Taskfile.yaml
└── puttokei.code-workspace
```

`infra/` は現時点では未作成。Terraform を追加する場合は 8.4 の構成に沿って作成する。

#### 8.2. バックエンド

クリーンアーキテクチャの4層構造を採用する。依存方向は domain ← application ← infrastructure / presentation。
Use Case は Unit of Work をトランザクション境界とし、`application` に抽象 IF、`infrastructure/persistence` に SQLAlchemy 実装を置く。

```markdown
backend/
├── src/
│   ├── main.py                        # FastAPIエントリポイント + Composition Root
│   ├── config.py                      # 環境変数・設定 (pydantic-settings)
│   ├── container.py                   # DI組み立て（Composition Root）
│   ├── common/                        # layer をまたいで使う最小限の共通基底
│   │
│   ├── domain/                        # ドメイン層 (外部依存なし・純粋Python)
│   │   ├── entities/
│   │   │   ├── user.py                # User エンティティ (dataclass)
│   │   │   ├── session.py             # Session エンティティ
│   │   │   ├── output.py              # Output エンティティ
│   │   │   ├── judgment.py            # Judgment エンティティ
│   │   │   └── user_settings.py       # UserSettings エンティティ
│   │   ├── value_objects/
│   │   │   ├── age_group.py           # AgeGroup 列挙型
│   │   │   ├── auth_provider.py       # AuthProvider 列挙型
│   │   │   ├── judgment_result.py     # LLM 判定の中間表現
│   │   │   ├── verdict.py             # Verdict 列挙型 (correct/partial/incorrect/rejected)
│   │   │   └── session_status.py      # SessionStatus 列挙型
│   │   ├── repositories/              # リポジトリインターフェース (ABC)
│   │   │   ├── user_repository.py
│   │   │   ├── session_repository.py
│   │   │   ├── output_repository.py
│   │   │   └── judgment_repository.py
│   │   └── services/                  # ドメインサービスインターフェース (ABC)
│   │       ├── auth_verifier.py       # 認証検証インターフェース
│   │       └── llm_judge_service.py   # LLM判定インターフェース
│   │
│   ├── application/                   # アプリケーション層 (Use Cases)
│   │   ├── unit_of_work.py            # Unit of Work IF / transaction boundary
│   │   ├── use_cases/
│   │   │   ├── authenticate_user.py   # Bearer token 検証 + ユーザー初期作成
│   │   │   ├── create_session.py      # セッション作成
│   │   │   ├── update_session_status.py # セッション状態更新
│   │   │   ├── submit_output.py       # アウトプット送信 + 判定キューイング
│   │   │   ├── get_judgment.py        # 判定結果取得
│   │   │   ├── list_today_outputs.py  # 今日のアウトプット一覧
│   │   │   ├── list_judgments.py      # 判定履歴一覧
│   │   │   ├── get_stats.py           # 統計取得
│   │   │   ├── get_user_profile.py    # プロフィール取得
│   │   │   ├── update_user_profile.py # プロフィール更新
│   │   │   ├── get_user_settings.py   # 設定取得
│   │   │   ├── update_user_settings.py # 設定更新
│   │   │   └── delete_account.py      # アカウント削除
│   │   └── dto/                       # Use Case 入出力 (dataclass or BaseModel)
│   │       ├── session_dto.py         # CreateSessionInput / SessionOutput
│   │       ├── judgment_dto.py        # JudgmentOutput / JudgmentListOutput
│   │       ├── stats_dto.py           # StatsOutput / DailyStatsOutput
│   │       ├── user_dto.py            # UserProfileOutput など
│   │       └── user_settings_dto.py   # UserSettingsOutput など
│   │
│   ├── infrastructure/                # インフラ層 (外部依存の実装)
│   │   ├── persistence/
│   │   │   ├── database.py            # DB接続管理 (async sessionmaker)
│   │   │   ├── unit_of_work.py        # SQLAlchemy Unit of Work 実装
│   │   │   ├── models/                # SQLAlchemy ORMモデル
│   │   │   │   ├── user_model.py
│   │   │   │   ├── session_model.py
│   │   │   │   ├── output_model.py
│   │   │   │   ├── judgment_model.py
│   │   │   │   └── rate_limit_log_model.py
│   │   │   └── repositories/          # リポジトリ実装 (PostgreSQL)
│   │   │       ├── pg_user_repository.py
│   │   │       ├── pg_session_repository.py
│   │   │       ├── pg_output_repository.py
│   │   │       └── pg_judgment_repository.py
│   │   ├── llm/                       # LLMプロバイダー実装
│   │   │   ├── gemini_provider.py
│   │   │   ├── openai_provider.py
│   │   │   ├── anthropic_provider.py
│   │   │   ├── prompts/
│   │   │   │   └── v1.py
│   │   │   └── factory.py            # プロバイダーファクトリ
│   │   ├── auth/
│   │   │   └── firebase_auth.py       # Firebase Admin SDK トークン検証
│   │   ├── queue/
│   │   │   └── cloud_tasks.py         # Cloud Tasks キューイング
│   │   └── notification/
│   │       └── fcm_notification.py    # Firebase Cloud Messaging
│   │
│   └── presentation/                  # プレゼンテーション層 (FastAPI)
│       ├── api/
│       │   └── v1/
│       │       ├── router.py          # v1ルーター統合
│       │       ├── auth.py            # 認証エンドポイント
│       │       ├── sessions.py        # セッションエンドポイント
│       │       ├── judgments.py        # 判定エンドポイント
│       │       ├── stats.py           # 統計エンドポイント
│       │       └── users.py           # ユーザーエンドポイント
│       ├── health.py                  # ヘルスチェック
│       ├── workers/                   # 非同期ワーカーエントリポイント
│       │   └── judge_worker.py        # Cloud Tasksハンドラー
│       ├── schemas/                   # Pydantic リクエスト/レスポンス (HTTP境界)
│       │   ├── session_schema.py
│       │   ├── judgment_schema.py
│       │   ├── user_schema.py
│       │   ├── user_settings_schema.py
│       │   └── problem_schema.py
│       ├── mappers/                   # HTTP response mapper
│       └── middleware/
│           ├── auth_middleware.py      # 認証ミドルウェア
│           └── rate_limit.py          # レートリミット
├── tests/
│   ├── conftest.py
│   ├── unit/                          # domain・use case の単体テスト
│   │   ├── test_entities/
│   │   └── test_use_cases/
│   ├── integration/                   # リポジトリ・API・LLMの結合テスト
│   │   ├── test_repositories/
│   │   └── test_llm/
│   ├── e2e/                           # APIエンドツーエンドテスト
│   │   └── test_api/
│   └── fakes/                         # Unit test 用 test double
├── db/
│   └── migrations/                    # Alembicマイグレーション
├── Dockerfile
├── pyproject.toml
├── uv.lock
├── alembic.ini
└── docker-compose.yml
```

#### 8.3. フロントエンド

```markdown
mobile/
├── app/                               # Expo Router (ルーティング定義のみ)
│   ├── _layout.tsx                    # ルートレイアウト
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── overview.tsx               # -> features/auth/screens
│   │   ├── tutorial-step-one.tsx      # -> features/auth/screens
│   │   ├── tutorial-step-two.tsx      # -> features/auth/screens
│   │   ├── tutorial-step-three.tsx    # -> features/auth/screens
│   │   └── sign-in.tsx                # -> features/auth/screens
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx                  # -> features/session/screens
│   │   ├── history.tsx                # -> features/history/screens
│   │   ├── stats.tsx                  # -> features/stats/screens
│   │   ├── settings.tsx               # -> features/settings/screens
│   │   └── session/[id]/
│   │       ├── input.tsx              # -> features/session/screens
│   │       ├── output.tsx             # -> features/session/screens
│   │       ├── break.tsx              # -> features/session/screens
│   │       └── result.tsx             # -> features/session/screens
│   ├── history/
│   │   └── [id].tsx                   # -> features/history/screens
│   └── profile/
│       ├── _layout.tsx
│       └── edit.tsx                   # -> features/profile/screens
│
├── src/
│   ├── features/                      # 機能単位モジュール
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   │   ├── OverviewScreen.tsx
│   │   │   │   ├── TutorialStepOneScreen.tsx
│   │   │   │   ├── TutorialStepTwoScreen.tsx
│   │   │   │   ├── TutorialStepThreeScreen.tsx
│   │   │   │   └── SignInScreen.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts         # 認証ロジック
│   │   │   └── api/
│   │   │       └── authApi.ts         # 認証 API client（現状は placeholder）
│   │   │
│   │   ├── session/
│   │   │   ├── screens/
│   │   │   │   ├── HomeScreen.tsx     # セッション開始画面
│   │   │   │   ├── InputScreen.tsx    # インプットフェーズ
│   │   │   │   ├── OutputScreen.tsx   # アウトプットフェーズ
│   │   │   │   ├── BreakScreen.tsx    # 休憩フェーズ
│   │   │   │   └── ResultScreen.tsx   # 判定結果表示
│   │   │   ├── components/
│   │   │   │   ├── OutputEditor.tsx   # アウトプット入力エディター
│   │   │   │   ├── JudgmentCard.tsx   # 判定結果カード
│   │   │   │   ├── AnnotatedOutputText.tsx
│   │   │   │   └── SessionPhaseChrome.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useTimer.ts        # タイマーロジック
│   │   │   │   └── useSession.ts      # セッション管理
│   │   │   └── api/
│   │   │       └── sessionApi.ts      # セッション関連API呼び出し
│   │   │
│   │   ├── history/
│   │   │   ├── screens/
│   │   │   │   └── HistoryScreen.tsx  # 判定履歴一覧
│   │   │   ├── components/
│   │   │   │   └── JudgmentListItem.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useJudgments.ts    # 履歴データ取得
│   │   │   │   └── useJudgmentDetail.ts
│   │   │   └── api/
│   │   │       └── judgmentApi.ts
│   │   │
│   │   ├── stats/
│   │   │   ├── screens/
│   │   │   │   └── StatsScreen.tsx    # 統計ダッシュボード
│   │   │   ├── components/
│   │   │   │   ├── PeriodSelector.tsx
│   │   │   │   ├── StatsChart.tsx
│   │   │   │   └── StatsSummaryCards.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useStats.ts
│   │   │   └── api/
│   │   │       └── statsApi.ts
│   │   │
│   │   ├── settings/
│   │   │   ├── screens/
│   │   │   │   └── SettingsScreen.tsx  # 設定画面
│   │   │   ├── hooks/
│   │   │   │   ├── useSettings.ts
│   │   │   │   ├── useUpdateSettings.ts
│   │   │   │   └── useDeleteAccount.ts
│   │   │   └── api/
│   │   │       └── settingsApi.ts
│   │   │
│   │   └── profile/
│   │       ├── screens/
│   │       │   └── ProfileEditScreen.tsx
│   │       ├── hooks/
│   │       │   ├── useProfile.ts
│   │       │   └── useUpdateProfile.ts
│   │       └── api/
│   │           └── profileApi.ts
│   │
│   └── shared/                        # 機能横断の共有リソース
│       ├── components/
│       │   ├── AuthGate.tsx
│       │   ├── BootScreen.tsx
│       │   ├── Card.tsx               # 共通カード
│       │   └── LoadingIndicator.tsx
│       ├── hooks/
│       │   └── useNotification.ts     # プッシュ通知
│       ├── lib/
│       │   ├── api.ts                 # fetch wrapper + 認証フック
│       │   ├── firebase.ts            # Firebase初期化
│       │   ├── notifications.ts       # プッシュ通知セットアップ
│       │   ├── queryClient.ts         # TanStack Query client
│       │   ├── splash.ts
│       │   ├── devMockAuth.ts
│       │   └── judgmentPresentation.ts
│       ├── stores/
│       │   ├── authStore.ts           # Zustand 認証ストア
│       │   ├── timerStore.ts          # Zustand タイマーストア
│       │   ├── loopStore.ts
│       │   └── tutorialStore.ts
│       └── types/
│           ├── api.ts                 # APIレスポンス型定義
│           ├── user.ts
│           └── userSettings.ts
│
├── app.json.example
├── eas.json
├── tsconfig.json
└── package.json
```

#### 8.4. インフラ

現時点では `infra/` は未作成。作成時は以下の module / environment 構成を基準にする。

```markdown
infra/
├── environments/
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── production/
│       ├── main.tf
│       ├── variables.tf
│       └── terraform.tfvars
└── modules/
    ├── cloud_run/
    ├── cloud_sql/
    ├── cloud_tasks/
    ├── iam/
    └── networking/
```

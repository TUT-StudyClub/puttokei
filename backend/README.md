# hourglass-backend

Hourglass の backend API。FastAPI / SQLAlchemy / Alembic / Firebase Admin SDK を採用したクリーンアーキテクチャ実装。

## 必要なツール

- Python 3.12（`.python-version` 参照）
- [uv](https://docs.astral.sh/uv/) `0.10.x`
- [go-task](https://taskfile.dev/) `3.x`（コマンドランナー）
- Docker（Cloud Run デプロイ確認用）
- PostgreSQL 15（ローカル開発時）

## セットアップ

```bash
task backend:install     # uv sync --frozen
cp backend/.env.example backend/.env  # 必要に応じて値を上書き
```

## よく使うコマンド

すべて `task` 経由で実行する。素の `uv run ...` を直接叩く必要はない。

| 用途                 | コマンド                                   |
| -------------------- | ------------------------------------------ |
| Lint                 | `task backend:lint`                        |
| Lint 自動修正        | `task backend:lint:fix`                    |
| Format               | `task backend:format`                      |
| Format 差分チェック  | `task backend:format:check`                |
| 型チェック           | `task backend:typecheck`                   |
| 依存方向チェック     | `task backend:lint:imports`                |
| テスト               | `task backend:test`                        |
| 開発サーバー         | `task backend:dev`                         |
| マイグレーション生成 | `task backend:db:revision -- "<message>"`  |
| マイグレーション適用 | `task backend:db:upgrade`                  |
| 1 つロールバック     | `task backend:db:downgrade`                |
| 適用済み確認         | `task backend:db:current`（DB 接続が必要） |
| ローカル HEAD 確認   | `task backend:db:heads`                    |
| Docker ビルド        | `task backend:docker:build`                |
| CI 相当を一括実行    | `task backend:ci`                          |

ルートから `task ci` を叩くと backend と mobile の両方を回せる。`task --list` で全コマンド一覧が見られる。

## ディレクトリ構成

要件書 §8.2 に沿った 4 層クリーンアーキテクチャ。依存方向は常に `domain ← application ← infrastructure / presentation`。

```
src/
├── main.py            FastAPI エントリポイント
├── config.py          pydantic-settings の Settings
├── container.py       DI 組み立て (Composition Root)
├── domain/            純粋 Python（外部依存なし）
├── application/       Use Case と DTO
├── infrastructure/    DB / LLM / 認証 / キュー / 通知 の実装
└── presentation/      FastAPI ルーター / health / workers / schemas / middleware

tests/
├── unit/              domain / use case の単体テスト
├── integration/       repository / LLM の結合テスト
└── e2e/               API の E2E テスト

db/migrations/         Alembic マイグレーション
```

## 後続 Epic で実装するもの

各レイヤーのファイルは骨組みのみ。各 Epic の Story で具体実装を追加する。

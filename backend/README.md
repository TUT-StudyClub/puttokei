# Puttokei backend

Puttokei の backend API。FastAPI / SQLAlchemy / Alembic / Firebase Admin SDK を採用したクリーンアーキテクチャ実装。

## 必要なツール

- Python 3.12（`.python-version` 参照）
- [uv](https://docs.astral.sh/uv/) `0.10.x`
- [go-task](https://taskfile.dev/) `3.x`（コマンドランナー）
- Docker（ローカル PostgreSQL / Cloud Run デプロイ確認用）

## セットアップ

```bash
task backend:install     # uv sync --frozen
cp backend/.env.example backend/.env  # 必要に応じて値を上書き
task backend:db:up       # Docker Compose で PostgreSQL 15 を起動
task backend:db:upgrade  # マイグレーション適用
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
| 開発サーバー（実機） | `task backend:dev:device`                     |
| PostgreSQL 起動      | `task backend:db:up`                       |
| PostgreSQL 停止      | `task backend:db:down`                     |
| PostgreSQL ログ      | `task backend:db:logs`                     |
| マイグレーション生成 | `task backend:db:revision -- "<message>"`  |
| マイグレーション適用 | `task backend:db:upgrade`                  |
| 1 つロールバック     | `task backend:db:downgrade`                |
| 適用済み確認         | `task backend:db:current`（DB 接続が必要） |
| ローカル HEAD 確認   | `task backend:db:heads`                    |
| Docker ビルド        | `task backend:docker:build`                |
| CI 相当を一括実行    | `task backend:ci`                          |

ルートから `task ci` を叩くと backend と mobile の両方を回せる。`task --list` で全コマンド一覧が見られる。

## アーキテクチャ

要件書 §8.2 に沿った 4 層クリーンアーキテクチャ。依存方向は常に `domain ← application ← infrastructure / presentation`。
`src.main` と `src.container` を Composition Root とし、presentation 層は `app.state` 経由で依存物を受け取る。

## ディレクトリ構成

```
src/
├── main.py            FastAPI エントリポイント
├── config.py          pydantic-settings の Settings
├── container.py       DI 組み立て (Composition Root)
├── common/            layer をまたいで使う最小限の共通基底
├── domain/            純粋 Python（外部依存なし）
├── application/       Use Case / DTO / mapper / Unit of Work IF
├── infrastructure/    DB / Unit of Work 実装 / LLM / 認証 / キュー / 通知 の実装
└── presentation/      FastAPI ルーター / health / workers / schemas / middleware / mapper

tests/
├── unit/              domain / use case の単体テスト
├── integration/       repository / API / LLM の結合テスト
├── e2e/               API の E2E テスト
└── fakes/             unit test 用 test double

db/migrations/         Alembic マイグレーション
```

## 実装状況

現在 `api_v1_router` に登録済みの API は `users` と `sessions`。`auth` / `judgments` / `stats` の router ファイルは存在するが、現時点ではプレースホルダーで router 登録されていない。

- 公開済み: `GET /health`, `GET /health/ready`
- 公開済み: `GET/PATCH /api/v1/users/me/profile`, `GET/PATCH /api/v1/users/me/settings`, `DELETE /api/v1/users/me`
- 公開済み: `POST /api/v1/sessions`, `GET /api/v1/sessions/outputs/today`, `PATCH /api/v1/sessions/{session_id}`, `POST /api/v1/sessions/{session_id}/output`, `GET /api/v1/sessions/{session_id}/judgment`
- 未実装: Cloud Tasks へのキューイングと worker 本体。開発環境では `local_judgment_enabled` により `submit_output` 内でローカル判定を実行できる。

## トランザクション境界

Use Case は `application.unit_of_work.ApplicationUnitOfWork` を通じて repository を利用する。`infrastructure.persistence.unit_of_work.SqlAlchemyUnitOfWork` が SQLAlchemy の `AsyncSession` と DB トランザクションを管理し、`container` が `UnitOfWorkFactory` として各 Use Case に注入する。

Use Case 内では `async with self.unit_of_work_factory() as uow:` を単位に処理し、成功時だけ `uow.commit()` する。未 commit または例外発生時は `__aexit__` で rollback される。

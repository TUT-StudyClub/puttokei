# hourglass-backend

Hourglass の backend API。FastAPI / SQLAlchemy / Alembic / Firebase Admin SDK を採用したクリーンアーキテクチャ実装。

## 必要なツール

- Python 3.12（`.python-version` 参照）
- [uv](https://docs.astral.sh/uv/) `0.10.x`
- Docker（Cloud Run デプロイ確認用）
- PostgreSQL 15（ローカル開発時）

## セットアップ

```bash
cd backend
uv sync
cp .env.example .env  # 必要に応じて値を上書き
```

## よく使うコマンド

| 用途 | コマンド |
| --- | --- |
| Lint | `uv run ruff check` |
| Format | `uv run ruff format` |
| 型チェック | `uv run ty check` |
| テスト | `uv run pytest` |
| マイグレーション生成 | `uv run alembic revision -m "<message>"` |
| マイグレーション適用 | `uv run alembic upgrade head` |
| 開発サーバー | `uv run uvicorn src.main:app --reload` |
| Docker ビルド | `docker build -t hourglass-backend .` |

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

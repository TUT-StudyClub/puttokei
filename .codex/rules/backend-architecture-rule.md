# backend アーキテクチャ規則

Puttokei backend は FastAPI / Python 3.12 / SQLAlchemy / Alembic / Pydantic / Firebase Admin SDK を使う API サーバー。Cloud Run で動かす前提で実装する。

## 使用アーキテクチャ

- 4 層のクリーンアーキテクチャを採用する
- 依存方向は `domain <- application <- infrastructure / presentation`
- `src.main` と `src.container` を Composition Root とし、依存の組み立てはここに集約する
- `domain` は外部依存を持たない。entity、value object、repository IF、service IF を置く
- `application` は use case と DTO を置く。adapter や Composition Root を import しない
- `infrastructure` は DB、Firebase、Cloud Tasks、LLM、FCM など外部依存の実装を置く
- `presentation` は FastAPI の HTTP 境界、schema、middleware、worker entrypoint を置く
- `infrastructure` と `presentation` は水平依存させない
- import 方向は `backend/pyproject.toml` の import-linter contract と整合させる

## ディレクトリ構成

```text
backend/
├── src/
│   ├── main.py              # FastAPI app 生成、router 登録、lifespan、例外 handler
│   ├── container.py         # DI 組み立て。Composition Root
│   ├── config.py            # pydantic-settings による環境変数管理
│   ├── common/              # layer をまたいで使う最小限の共通基底
│   ├── domain/              # entity / value object / repository IF / service IF
│   ├── application/         # use case / DTO
│   ├── infrastructure/      # persistence / auth / queue / llm / notification
│   └── presentation/        # FastAPI router / schema / middleware / health / workers
├── db/
│   └── migrations/          # Alembic migration
├── tests/
│   ├── unit/                # domain / use case の単体テスト
│   ├── integration/         # repository / API / LLM などの結合テスト
│   ├── e2e/                 # API E2E テスト
│   └── fakes/               # test double
├── Dockerfile
├── pyproject.toml
├── alembic.ini
└── docker-compose.yml       # ローカル PostgreSQL
```

## layer ごとの責務

- `domain/entities`: `User` `Session` `Output` `Judgment` などの業務オブジェクト
- `domain/value_objects`: `SessionStatus` `Verdict` などの enum / value object
- `domain/repositories`: 永続化の interface
- `domain/services`: 認証検証や LLM 判定などの service interface
- `application/use_cases`: API や worker から呼ばれる application service
- `application/dto`: use case の入出力型
- `infrastructure/persistence`: DB 接続、SQLAlchemy model、PostgreSQL repository 実装
- `infrastructure/auth`: Firebase Admin SDK など認証実装
- `infrastructure/queue`: Cloud Tasks など queue 実装
- `infrastructure/llm`: LLM provider、prompt、provider factory
- `infrastructure/notification`: FCM など通知実装
- `presentation/api`: FastAPI router
- `presentation/schemas`: HTTP request / response の Pydantic schema
- `presentation/middleware`: 認証、rate limit など HTTP middleware
- `presentation/workers`: Cloud Tasks など外部 entrypoint

## 実装ルール

- 新しいビジネスルールはまず `domain` に置けるか検討する
- API endpoint から DB や外部 API を直接呼ばず、use case を経由する
- SQLAlchemy model と domain entity を混同しない
- HTTP request / response の型は `presentation/schemas`、use case の入出力は `application/dto` に置く
- repository IF を増やす場合は `domain/repositories`、実装は `infrastructure/persistence/repositories` に分ける
- Cloud Tasks の handler は `presentation/workers` を entrypoint とし、処理本体は use case に寄せる
- `src.common` は共通基底など最小限に限定し、便利置き場にしない

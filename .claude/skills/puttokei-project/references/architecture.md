# puttokei アーキテクチャ参照

## 正とする資料

- 主資料は `docs/requirements/requirements.md`
- `docs/requirements/technical_book.md` は同内容の複製として扱ってよい
- 全体構成と infra の規則は `.claude/rules/project-architecture-rule.md`
- backend の詳細なディレクトリ構成とアーキテクチャ規則は `.claude/rules/backend-architecture-rule.md`
- mobile の詳細なディレクトリ構成とアーキテクチャ規則は `.claude/rules/mobile-architecture-rule.md`
- ルート直下の `README` `Taskfile.yaml` `workflow` 群は空のことがあるので、実装前に必ず中身を確認する

## 全体構成

- モバイル: React Native + Expo + TypeScript
- API: FastAPI を Cloud Run で動かす
- データ: Cloud SQL for PostgreSQL 15 と Cloud Storage
- 周辺: Firebase Authentication、Cloud Tasks、FCM、Secret Manager、Terraform

## 想定ユーザーフロー

1. セッション開始
2. インプット
3. アウトプット送信
4. 非同期で LLM 判定
5. 結果確認

## backend の期待構成

- `src/main.py`: FastAPI エントリポイント
- `src/domain`: エンティティ、値オブジェクト、リポジトリ IF、サービス IF
- `src/application`: ユースケースと DTO
- `src/infrastructure`: DB、LLM、認証、キュー、通知の実装
- `src/presentation`: FastAPI ルーター、スキーマ、ヘルスチェック、ミドルウェア、ワーカー
- `tests/unit` `tests/integration` `tests/e2e`: テスト種別ごとに分割

依存方向は常に `domain <- application <- infrastructure / presentation` を維持する。

## mobile の期待構成

- `app/`: Expo Router の経路定義のみ
- `src/features/*`: 画面、hooks、components、feature ごとの API 呼び出し
- `src/shared`: 共通 UI、hooks、stores、lib、types

画面本体を `app/` に直接書かず、`features` 側へ寄せる。

## infra の期待構成

- `infra/modules`: 再利用する Terraform モジュール
- `infra/environments/staging`: ステージング環境
- `infra/environments/production`: 本番環境

環境ごとに丸ごと複製せず、なるべくモジュールを使い回す。

## 実装時の注意

- backend では責務をまたいだ直書きを避ける
- mobile では feature 単位のまとまりを壊さない
- infra では module と environment の境界を崩さない
- 実装がまだ無い場合は、設計書どおりの骨組みを先に作る

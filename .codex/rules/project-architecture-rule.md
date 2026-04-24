# プロジェクト構成・アーキテクチャ規則

Puttokei で `backend/` `mobile/` `infra/` を触るときは、この構成と責務分離を基準にする。詳細仕様は `docs/requirements/requirements.md` を正とする。

## 全体

- `backend/`: FastAPI / Python 3.12 の API。Cloud Run で動かす前提
- `mobile/`: Expo / React Native / TypeScript のモバイルアプリ
- `infra/`: Terraform + Google Cloud のインフラ定義
- `docs/requirements/`: 要件、API、DB、認証、CI/CD、構成の主資料
- `AGENTS.md` / `CLAUDE.md`: エージェント向け運用ルール
- `.codex/skills` / `.claude/skills`: 作業用 skill
- `.codex/rules` / `.claude/rules`: 横断的に守る規則

## 詳細ルール

- backend の詳細なディレクトリ構成とアーキテクチャは `.codex/rules/backend-architecture-rule.md`
- mobile の詳細なディレクトリ構成とアーキテクチャは `.codex/rules/mobile-architecture-rule.md`

## infra

- Terraform + Google Cloud を前提にする
- 再利用単位は `infra/modules`
- 環境差分は `infra/environments/{staging,production}`
- Cloud Run、Cloud SQL、Cloud Tasks、Secret Manager、Firebase / FCM 連携を想定する
- `infra/` が空または未整備の場合は、`docs/requirements/requirements.md` に沿って module / environment の骨組みから作る

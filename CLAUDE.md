日本語で回答してください。

リポジトリの運用ルールや作業前提を追加・変更した場合は、必要に応じて `AGENTS.md` と `CLAUDE.md` を随時更新し、両者の整合を保ってください。

`backend/` `mobile/` `infra/` を触る場合や、ディレクトリ構成・土台実装を新しく作る場合は `.claude/skills/puttokei-project` の前提に従ってください。

全体構成と infra の規則は `.claude/rules/project-architecture-rule.md`、backend の詳細は `.claude/rules/backend-architecture-rule.md`、mobile の詳細は `.claude/rules/mobile-architecture-rule.md` を参照してください。

VS Code / Cursor では、リポジトリルートの `puttokei.code-workspace` を標準ワークスペースとして使ってください。

ローカル開発用の PostgreSQL は `backend/docker-compose.yml` の Docker Compose で起動し、リポジトリルートでは `task backend:db:up`、`backend/` 配下では `task db:up` を使ってください。

コミットを作成する場合は `.claude/rules/commit-message-rule.md` の規則に従ってください。

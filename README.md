# Puttokei

Puttokei は、学習フロー `input -> output -> break -> result` を支える backend API と
mobile アプリを同じリポジトリで管理するプロジェクトです。

- `backend/`: FastAPI / Python 3.12 / SQLAlchemy / Alembic
- `mobile/`: Expo / React Native / TypeScript / Tamagui
- `docs/requirements/`: 要件と技術仕様

## 必要なツール

- Python 3.12
- uv `0.10.x`
- Node.js `>=20`
- npm
- go-task `3.x`
- Docker
- VS Code または Cursor

## ワークスペース

VS Code / Cursor では、リポジトリルートの `puttokei.code-workspace` を開いてください。
共有するエディタ設定、推奨拡張、主要な `task` コマンドはこのファイルに集約しています。

```bash
code puttokei.code-workspace
```

## 初回セットアップ

```bash
task install
cp backend/.env.example backend/.env
task backend:db:up
task backend:db:upgrade
```

PostgreSQL は `backend/docker-compose.yml` の Docker Compose で起動します。

## よく使うコマンド

```bash
task --list              # 利用可能な task を表示
task backend:dev         # FastAPI 開発サーバー
task mobile:start        # Expo 開発サーバー
task mobile:web          # Expo Web プレビュー
task backend:db:up       # ローカル PostgreSQL 起動
task backend:db:down     # ローカル PostgreSQL 停止
```

## チェック

```bash
task lint
task typecheck
task test
task ci
```

`task ci` は backend と mobile の CI 相当チェックをまとめて実行します。

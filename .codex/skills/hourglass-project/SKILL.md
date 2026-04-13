---
name: hourglass-project
description: Hourglass リポジトリで作業するときの前提をまとめた skill。docs/requirements/requirements.md を基準に、backend の FastAPI/Python、mobile の Expo/TypeScript、infra の Terraform、空ディレクトリの初期実装や構成整理を行うときに使う。
---

# Hourglass Project

## 概要

このリポジトリは実装より設計書が先行している。トップレベルの `README` や `Taskfile.yaml`、各ディレクトリ内の実装が空のことがあるため、足りないものを作るときは `docs/requirements/requirements.md` を正として扱う。

## 使う場面

- `backend/` `mobile/` `infra/` を触る
- API、DB、認証、LLM 判定フローを決める
- ディレクトリ構成や土台コードを新しく作る
- 設計書どおりに実装を揃える

## 作業ルール

1. まず変更対象ディレクトリの現状を確認する
2. 既存コードがある場合は、その周辺の流儀を崩さずに合わせる
3. 空ディレクトリやプレースホルダーしかない場合は、設計書に沿って素直に土台を作る
4. 実装と設計書が食い違う場合は、変更箇所の一貫性を優先しつつ、最終報告で差分を明示する
5. 詳細が必要なときだけ `references/` を読む

## 前提アーキテクチャ

### backend

- FastAPI / Python 3.12 / SQLAlchemy / Alembic / Pydantic / Firebase Admin SDK
- 依存方向は `domain <- application <- infrastructure / presentation`
- HTTP 入出力は `presentation`
- ユースケースは `application`
- DB、認証、キュー、LLM など外部依存は `infrastructure`

### mobile

- Expo + React Native + TypeScript
- `app/` は Expo Router の経路定義だけに寄せる
- 画面実装や機能ロジックは `src/features/*`
- 共通部品は `src/shared`
- ローカル状態は Zustand、サーバー状態は TanStack Query、フォームは React Hook Form + Zod、UI は Tamagui

### infra

- Terraform + Google Cloud
- 再利用単位は `infra/modules`
- 環境差分は `infra/environments/{staging,production}`

## プロダクト上の制約

- 認証は Firebase Authentication を前提にする
- 学習フローは `input -> output -> break -> result`
- アウトプットの判定は Cloud Tasks 経由の非同期処理にする
- LLM の応答は JSON として検証・保存できる形を崩さない

## 参照先

- 構成と責務分離は `references/architecture.md`
- API / DB / 認証 / LLM / CI の期待値は `references/contracts.md`
- 正確な文言や完全な仕様が必要なときだけ `docs/requirements/requirements.md` を開く

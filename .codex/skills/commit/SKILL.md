---
name: commit
description: このリポジトリでコミットを作るための skill。.codex/rules/commit-message-rule.md に沿った日本語の Conventional Commits 形式で、現在の変更を安全にコミットするときに使う。
---

# Commit

## 手順

1. `git status --short` `git diff --staged` `git diff` `git log --oneline -10` で状態を確認する
2. 形式が曖昧なら `.codex/rules/commit-message-rule.md` を見直す
3. メッセージは `.codex/rules/commit-message-rule.md` の形式に従う
4. `type` はルールで定義されたものから選ぶ
5. 件名と本文は日本語で書く。`docs` 以外は、なぜ変更したかが分かる本文を付ける
6. `git add <file> ...` で対象ファイルを明示的にステージする
7. 非対話でコミットする
8. 最後に `git status` を見直す

## ルール

- `scope` が不要なら省略してよい
- `git add -A` や `git add .` は使わない
- `--amend` は明示依頼があるときだけ使う
- 空コミットは明示依頼があるときだけ作る
- 機密情報や credential 類が含まれていないかを確認する
- push は明示依頼があるときだけ行う

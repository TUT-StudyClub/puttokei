---
name: commit
description: 日本語の Conventional Commits 形式でコミットを作成する
disable-model-invocation: true
---

現在の変更を `.claude/rules/commit-message-rule.md` に沿った日本語の Conventional Commits 形式でコミットする。

## 手順

1. 変更内容の把握:
   - `git status`（`-uall` は使わない）
   - `git diff --staged`
   - 未ステージの差分があれば `git diff`
2. 過去のスタイルを確認: `git log --oneline -10`
3. `.claude/rules/commit-message-rule.md` の定義に従って type と形式を決める
4. 日本語のタイトル 1 行（〜50 文字目安）+ 必要なら本文を作成。なぜ変更したかを重視し、diff を読めば分かる詳細は書かない
5. 機密ファイル（`.env`、credential 系、秘密鍵）が含まれていないか確認。含まれていればユーザーに警告
6. 対象ファイルを明示的に `git add <file> ...` でステージ（`git add -A` / `git add .` は避ける）
7. HEREDOC でコミットメッセージを渡す:

```bash
git commit -m "$(cat <<'EOF'
feat: ○○機能を追加

△△のため □□ を実装
EOF
)"
```

8. `git status` で結果を確認

## ルール

- `--amend` は明示的に指定されたときのみ使用。既定は新規コミット
- pre-commit hook が失敗した場合は問題を修正 → 再ステージ → 新しいコミットを作成（`--no-verify` は使わない）
- 変更が無い場合は空コミットを作らない
- リモートへの push はユーザーが明示的に依頼したときのみ

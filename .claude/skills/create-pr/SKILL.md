---
name: create-pr
description: プルリクエストの作成・更新を行う
disable-model-invocation: true
---

現在のブランチでプルリクエストを作成または更新する。

1. PR が既に存在するか確認: `gh pr view --json number,title,body,url 2>/dev/null`

## PR が存在する場合 → 更新

2. 未プッシュのコミットを確認: `git log origin/$(git branch --show-current)..HEAD --oneline 2>/dev/null`
3. `git diff origin/main...HEAD` で全変更内容を把握
4. 現在の変更内容に基づいて PR のタイトルと本文を更新:
   `gh api repos/{owner}/{repo}/pulls/{number} -X PATCH -f title="{{TITLE}}" -f body="{{BODY}}"`
5. ブラウザで PR を開く: `gh pr view --web`

## PR が存在しない場合 → 作成

2. `git diff origin/main...HEAD` で全変更内容を把握
3. ブランチがプッシュ済みか確認: `git log origin/$(git branch --show-current)..HEAD --oneline 2>/dev/null`
4. `.github/PULL_REQUEST_TEMPLATE.md` のテンプレートを使ってドラフト PR を作成:

```bash
gh pr create --draft --title "{{TITLE}}" --body-file <(cat .github/PULL_REQUEST_TEMPLATE.md)
```

5. PR テンプレートを埋める:
   - "What's changed" セクションに変更内容のまとめを記載
   - "How to verify it" セクションにスクリーンショットや検証手順を追加

6. **スクリーンショットの撮影**（UI の変更がある場合）: `screenshot` スキルを使って該当ページをキャプチャ。スクリーンショットは `screenshots/<PR_NUMBER>/` に保存される。GitHub の PR 説明欄にドラッグ＆ドロップするようユーザーに伝える。

7. ブラウザで PR を開く: `gh pr view --web`

## PR の文章ルール

- **本質的な情報だけ書く** — 冗長な説明や自明な内容は省く
- 変更の「何を・なぜ」を簡潔に箇条書きで記載。diff を見ればわかる詳細は書かない
- Release QA は具体的な確認項目のみ。一般的・汎用的なチェック項目は不要

## 重要事項

- PR の更新には `gh pr edit` ではなく `gh api` を使う（Projects Classic の非推奨エラーを回避するため）
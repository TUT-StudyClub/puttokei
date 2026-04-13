---
name: create-pr
description: このリポジトリの現在ブランチに対して GitHub PR を作成または更新する skill。ドラフト PR の起票、既存 PR の説明更新、PR 本文の整形が必要なときに使う。
---

# Create PR

## 手順

1. `gh pr view --json number,title,body,url 2>/dev/null` で既存 PR の有無を確認する
2. ベースブランチとの差分を把握してから PR 文面を作る
3. PR がある場合は、現在の差分に合わせてタイトルと本文を更新する
4. PR が無い場合は、ドラフト PR を作る
5. `.github/PULL_REQUEST_TEMPLATE.md` に中身があるなら優先して使う
6. UI 変更がある場合は `screenshot` skill を使って `screenshots/<PR_NUMBER>/` に保存する
7. ブラウザ表示はユーザーが求めたとき、または作業上必要なときだけ行う

## 文面ルール

- 原則日本語で書く
- 何を変えたかと、なぜ変えたかを短く書く
- diff を見れば分かる細部を本文に繰り返さない
- 検証手順は具体的に書く

## 注意

- `gh pr edit` が不安定なら `gh api ... -X PATCH` を使う
- PR テンプレートが空なら、空テンプレートを無理に使わず短い本文を手で組み立てる

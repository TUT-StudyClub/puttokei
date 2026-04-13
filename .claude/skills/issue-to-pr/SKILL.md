---
name: issue-to-pr
description: GitHub Issue からブランチ作成・実装方針合意・ドラフト PR 作成まで一気通貫で行う
disable-model-invocation: true
---

Issue を起点にブランチを切り、実装方針をユーザーと合意したうえでドラフト PR を作成する。

## 手順

1. 引数で Issue 番号を受け取り内容取得:
   `gh issue view <num> --json number,title,body,labels,assignees`
2. Issue 内容を日本語で要約し、ユーザーに提示:
   - 背景・目的
   - 完了条件（Issue の記述から抽出）
   - 影響範囲（推定）
3. 実装方針の素案を提示し、ユーザーと合意を取る
4. ブランチ命名を提案して切り替え:
   - ラベルや内容から種別を判定: `feature/` `fix/` `chore/` `docs/` など
   - 形式: `<type>/<issue-num>-<kebab-slug>`（例: `feature/42-add-login-form`）
   - `git switch -c <branch>`
5. 最初のコミットを作成:
   - 実際の変更があればそれをコミット（`commit` スキルを使用）
   - 無ければ `git commit --allow-empty -m "chore: issue #<num> 対応を開始"` で起点コミット
6. リモートへ push: `git push -u origin <branch>`
7. `create-pr` スキルを呼び出してドラフト PR を作成
   - PR 本文に必ず `Closes #<issue-num>` を含める
   - タイトルは Issue タイトルを踏まえた日本語の Conventional Commits 形式

## 注意

- 実装自体はこのスキルでは行わない。あくまで起点作り
- Issue が既に着手中（Assignee 設定済・関連ブランチ存在）でないかを確認してから進める

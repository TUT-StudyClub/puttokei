---
name: issue-to-pr
description: GitHub Issue を起点に作業を始めるための skill。issue の要約、実装方針の整理、ブランチ作成、ドラフト PR 起票まで一連で進めたいときに使う。
---

# Issue To PR

## 手順

1. `gh issue view <num> --json number,title,body,labels,assignees` で Issue を読む
2. 次を日本語で要約する
   - 背景と目的
   - 完了条件
   - 影響範囲
3. 実装方針の素案を出して、ユーザーと合意してから進める
4. ブランチ名は `<type>/<issue-num>-<kebab-slug>` 形式にする
5. 変更があるなら `commit` skill を使って最初のコミットを作る
6. まだ変更が無い場合は、空コミットが本当に必要かを確認してから作る
7. ブランチを push する
8. `create-pr` skill を使ってドラフト PR を作る
9. PR 本文には `Closes #<issue-num>` を入れる

## 注意

- この skill は着手準備と PR 起票の流れを整えるもの
- すでに着手済みの Issue でないか確認してからブランチを切る

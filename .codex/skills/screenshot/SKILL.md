---
name: screenshot
description: UI スクリーンショットを取得して保存する skill。PR 添付用や画面確認用に、desktop / mobile のキャプチャを screenshots/<PR_NUMBER>/ 配下へ保存するときに使う。
---

# Screenshot

## 手順

1. `gh pr view --json number -q .number 2>/dev/null` で PR 番号を取得する
2. PR が無い場合は、保存先名をユーザーに確認する
3. `screenshots/<target>/` を作る
4. 対象 URL と必要な viewport を確認する
5. Playwright で desktop と必要に応じて mobile を撮る
6. 保存パスを報告する

## 注意

- PR 用なら保存先は `screenshots/<PR_NUMBER>/` を優先する
- ページ全体が必要なときだけ `--full-page` を使う
- Playwright が未導入なら、ブラウザ導入前にユーザー確認を取る
- ログインが必要な画面は資格情報の扱いを確認してから進める

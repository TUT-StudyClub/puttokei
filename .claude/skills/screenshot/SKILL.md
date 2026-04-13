---
name: screenshot
description: UI 画面をキャプチャして screenshots/<PR_NUMBER>/ に保存する
disable-model-invocation: true
---

指定した URL の画面を Playwright でキャプチャし、PR に貼り付けられる形で保存する。

## 手順

1. 現在の PR 番号を取得: `gh pr view --json number -q .number 2>/dev/null`
   - 取得できない場合はユーザーに PR 番号（または任意の保存先名）を確認
2. 保存先ディレクトリを作成: `mkdir -p screenshots/<PR_NUMBER>/`
3. 撮影対象の URL・ページをユーザーに確認（例: `http://localhost:3000/settings`）
4. Playwright CLI でキャプチャ:

```bash
# デスクトップ
npx playwright screenshot "<URL>" "screenshots/<PR_NUMBER>/<name>.png"

# モバイル（iPhone 14 相当）
npx playwright screenshot --viewport-size=390,844 "<URL>" "screenshots/<PR_NUMBER>/<name>-mobile.png"
```

5. フルページが必要なら `--full-page` を付与
6. 保存先パスを報告し、GitHub の PR 説明欄にドラッグ＆ドロップするよう伝える

## 注意

- Playwright 未インストール時はユーザーに確認のうえ `npx playwright install chromium` を実行
- `create-pr` スキルから呼び出される契約として、保存先は必ず `screenshots/<PR_NUMBER>/` 配下
- ログインが必要な画面は認証情報の扱いをユーザーに確認してから実行

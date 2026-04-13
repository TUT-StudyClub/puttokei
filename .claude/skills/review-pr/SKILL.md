---
name: review-pr
description: 指定された PR を観点別にレビューし、日本語でコメントを生成する
disable-model-invocation: true
---

GitHub PR の差分を取得し、観点別に日本語でレビューする。

## 手順

1. 引数で PR 番号または URL を受け取る。無ければ現在ブランチの PR を対象:
   `gh pr view --json number -q .number`
2. メタ情報取得: `gh pr view <num> --json title,body,author,files,additions,deletions,baseRefName,headRefName`
3. 差分取得: `gh pr diff <num>`
4. 以下の観点で日本語のレビューを作成:
   - **設計・アーキテクチャ**: 責務分離、レイヤー違反、既存パターンとの整合
   - **バグ・ロジック**: エッジケース、null/undefined、非同期の取りこぼし、競合
   - **テスト**: 不足しているケース、モックの妥当性、境界値
   - **セキュリティ**: 入力検証、認可、機密情報の扱い、OWASP Top 10
   - **可読性・命名**: 命名の一貫性、過剰な抽象化、不要なコメント
5. 出力フォーマット:

```markdown
## レビュー結果

### 👍 良い点
- ...

### 🔍 指摘事項
- **[設計]** <ファイル:行> — 指摘内容と提案
- **[バグ]** ...

### ❓ 質問・確認
- ...
```

6. ユーザーに投稿するか確認。投稿する場合:
   `gh pr comment <num> --body-file -`
   （デフォルトは標準出力のみ）

## 注意

- 差分が大きい場合はファイル単位で優先度をつけてレビュー
- 自明な内容や "LGTM" だけのコメントは書かない。根拠と改善提案をセットで

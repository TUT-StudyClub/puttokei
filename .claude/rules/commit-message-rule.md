# コミットメッセージ規則

このリポジトリでは、コミットメッセージを日本語の Conventional Commits 形式で統一する。

## 形式

```text
<type>(<scope>): <summary>

<body>

<footer>
```

## type

以下から選ぶ。

- `build`: ビルド設定や依存関係の変更
- `ci`: CI/CD 設定の変更
- `docs`: ドキュメントのみの変更
- `feat`: 機能追加
- `fix`: バグ修正
- `perf`: パフォーマンス改善
- `refactor`: 挙動を変えない構造改善
- `test`: テストの追加・修正

## scope

- 任意
- 影響範囲が明確なときだけ付ける
- 明確でない場合は省略してよい

## summary

- 1 行で簡潔に書く
- 日本語で書く
- 文末に句点を付けない
- 何をしたかがすぐ分かる表現にする

例:

- `feat(mobile): 学習開始画面を追加`
- `fix(backend): 判定結果の取得時に 404 になる不具合を修正`

## body

- `docs` 以外では原則付ける
- なぜ変更したか、背景や意図を書く
- diff を見れば分かる実装詳細の羅列は避ける
- 20 文字以上を目安にする

## footer

- 必要な場合のみ付ける
- `Closes #123` や `Fixes #123` のような Issue 参照を置いてよい
- 互換性破壊がある場合は `BREAKING CHANGE:` を使う

## revert

差し戻しは次の形式にする。

```text
revert: <reverted commit header>

This reverts commit <sha>.
```

## チェック項目

- `type(scope): summary` の形になっているか
- type が定義済みのものか
- summary が簡潔で、末尾が句点で終わっていないか
- `docs` 以外は body があり、理由が書かれているか
- footer が必要な場合に正しく付いているか

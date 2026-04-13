<!--
コミットメッセージは `.claude/rules/commit-message-rule.md` の規則（日本語 Conventional Commits）に従ってください。
-->

## 概要

<!-- 何を、なぜ変更したかを 1〜3 文で記載してください -->

## 関連 Issue

<!--
Closes #<issue>     ... この PR で完了する Story / Task
Refs #<issue>       ... 参照する Epic / Story
-->

- Closes #
- Refs #

## 変更内容

<!-- 主な変更点を箇条書きで。差分から自明なものは省略可 -->

-

## スコープ外 / 残課題

<!-- 意図的にやらなかったこと、後続 PR / Issue で扱うことがあれば記載 -->

-

## 動作確認

<!-- task コマンドで再現できる手順を記載してください。UI 変更がある場合はスクリーンショット / 動画も添付 -->

```bash
# 例
task ci                       # backend と mobile の lint / typecheck / test を一括
task backend:dev              # http://localhost:8000/health で 200 を確認
task mobile:start             # Expo を起動して該当画面を確認
```

### スクリーンショット / 動画

<!-- UI 変更がある場合のみ。before / after を並べると分かりやすい -->

## チェックリスト

- [ ] `task ci` がローカルで通る（または該当する個別タスクが通る）
- [ ] 関連 Issue を `Closes` / `Refs` で正しく紐付けている
- [ ] 仕様書（`docs/requirements/requirements.md`）と矛盾していない、または差分を本文に明記している
- [ ] 破壊的変更がある場合はコミットメッセージに `BREAKING CHANGE:` を含めている

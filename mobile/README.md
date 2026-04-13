# hourglass-mobile

Hourglass の React Native / Expo アプリ。Expo Router / TypeScript / Tamagui / Zustand / TanStack Query / Axios を採用。

## 必要なツール

- Node.js `>=20`
- npm（`.npmrc` で `save-exact` を強制しているので、追加インストール時もバージョンが固定される）
- [go-task](https://taskfile.dev/) `3.x`（コマンドランナー）
- Xcode（iOS 実機 / シミュレータ確認時）
- Android Studio（Android 確認時）

## セットアップ

```bash
task mobile:install   # npm ci
```

## よく使うコマンド

すべて `task` 経由で実行する。素の `npm` / `npx` を直接叩く必要はない。

| 用途                     | コマンド                   |
| ------------------------ | -------------------------- |
| 開発サーバー             | `task mobile:start`        |
| iOS シミュレータ起動     | `task mobile:ios`          |
| Android エミュレータ起動 | `task mobile:android`      |
| Web プレビュー           | `task mobile:web`          |
| Lint                     | `task mobile:lint`         |
| Lint 自動修正            | `task mobile:lint:fix`     |
| Format                   | `task mobile:format`       |
| Format 差分チェック      | `task mobile:format:check` |
| 型チェック               | `task mobile:typecheck`    |
| テスト                   | `task mobile:test`         |
| テスト watch             | `task mobile:test:watch`   |
| Expo ヘルスチェック      | `task mobile:doctor`       |
| CI 相当を一括実行        | `task mobile:ci`           |

ルートから `task ci` を叩くと backend と mobile の両方を回せる。`task --list` で全コマンド一覧が見られる。

## ディレクトリ構成

要件書 §8.3 に沿う構成。`app/` は Expo Router の経路定義のみとし、画面実装は `src/features` に寄せる。

```
app/                Expo Router 経路定義のみ
├── _layout.tsx     ルートレイアウト（Tamagui / TanStack Query Provider）
├── (auth)/         認証スタック
├── (tabs)/         タブナビゲーション
└── session/[id]/   学習セッション内の各フェーズ

src/
├── features/       機能単位モジュール（auth / session / history / stats / settings）
│   └── <feature>/{screens,components,hooks,api}/
└── shared/         機能横断の共有リソース
    ├── components/  Button / Card / LoadingIndicator
    ├── lib/         api (Axios) / queryClient (TanStack Query) / firebase / notifications
    ├── stores/      authStore / timerStore (Zustand)
    ├── hooks/
    └── types/
```

## HTTP クライアント

要件書 §2.1 に沿って **Axios** を採用する。`src/shared/lib/api.ts` に Axios インスタンスを定義し、認証トークンは `setTokenProvider` で差し込む。要件書 §8.3 のコメントには `ky` の記述が残っているが、`.2.1` を優先する。

## 後続 Epic で実装するもの

各 feature の screens / hooks / api は placeholder。各 Epic の Story で具体実装を追加する。

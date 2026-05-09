# Puttokei mobile

Puttokei の React Native / Expo アプリ。Expo Router / TypeScript / Tamagui / Zustand / TanStack Query / Fetch API を採用。

## 必要なツール

- Node.js `>=20`
- npm（`.npmrc` で `save-exact` を強制しているので、追加インストール時もバージョンが固定される）
- [go-task](https://taskfile.dev/) `3.x`（コマンドランナー）
- Xcode（iOS 実機 / シミュレータ確認時）
- Android Studio（Android 確認時）

## セットアップ

```bash
task mobile:install   # npm ci
cp mobile/.env.example mobile/.env.local
```

`.env.local` の `EXPO_PUBLIC_*` を埋める。チーム共通値 (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` / `EXPO_PUBLIC_EAS_PROJECT_ID` / `EXPO_PUBLIC_EAS_OWNER` など) は Slack / Notion / 1Password / EAS Cloud env、または ryu から取得する。

個人差項目 (`EXPO_PUBLIC_APPLE_TEAM_ID` / `EXPO_PUBLIC_BUNDLE_IDENTIFIER` / `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_GOOGLE_SERVICES_IOS`) は自分の環境に合わせる。Apple Developer Program 未加入の場合は Personal Team ID と重複しない Bundle ID を使い、Firebase Console でその Bundle ID 用の iOS App を登録して plist を `mobile/` 配下に配置する。

`app.json.example` はテンプレートなので `YOUR_*` プレースホルダを維持する。通常は `.env.local` だけで上書きし、env で表現しづらい複雑な構造を変えたい場合だけ `app.json.example` を `app.json` にコピーして overlay として使う。

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

TestFlight 向けの EAS Build / Submit とローカル実機への直接ビルド手順は [build-and-release.md](./build-and-release.md) を参照する。

## アーキテクチャ

要件書 §8.3 に沿う構成。`app/` は Expo Router の経路定義のみとし、画面実装は `src/features` に寄せる。
共通初期化、HTTP client、Firebase、通知、Zustand store は `src/shared` に置く。

## ディレクトリ構成

```
app/                Expo Router 経路定義のみ
├── _layout.tsx     ルートレイアウト（Tamagui / TanStack Query Provider）
├── (auth)/         概要、チュートリアル、サインイン
├── (tabs)/         ホーム、統計、非表示 tab route、セッション内フェーズ
├── history/[id].tsx
└── profile/        プロフィール編集

src/
├── features/       機能単位モジュール（auth / session / history / stats / settings / profile）
│   └── <feature>/{screens,components,hooks,api}/
└── shared/         機能横断の共有リソース
    ├── components/  AuthGate / BootScreen / Card / LoadingIndicator
    ├── lib/         api (fetch wrapper) / queryClient (TanStack Query) / firebase / notifications
    ├── stores/      authStore / timerStore / loopStore / tutorialStore (Zustand)
    ├── hooks/
    └── types/
```

## HTTP クライアント

`src/shared/lib/api.ts` で **fetch ベースの共通クライアント** を提供し、認証トークンは `setTokenProvider` で差し込む。Bearer トークン付与と JSON 送受信はこのラッパーに集約する。

## 実装状況

現在は auth / session / history / stats / settings / profile の screen・hook・API client が実装済み。`history` と `stats` の mobile 側 API client は存在するが、backend 側の `/judgments` と `/stats` router はまだ公開されていないため、結合時は backend の実装状況を確認する。

# hourglass-mobile

Hourglass の React Native / Expo アプリ。Expo Router / TypeScript / Tamagui / Zustand / TanStack Query / Axios を採用。

## 必要なツール

- Node.js `>=20`
- npm（`.npmrc` で `save-exact` を強制しているので、追加インストール時もバージョンが固定される）
- Xcode（iOS 実機 / シミュレータ確認時）
- Android Studio（Android 確認時）

## セットアップ

```bash
cd mobile
npm install
```

## よく使うコマンド

| 用途 | コマンド |
| --- | --- |
| 開発サーバー | `npm start` |
| iOS シミュレータ起動 | `npm run ios` |
| Android エミュレータ起動 | `npm run android` |
| Web プレビュー | `npm run web` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| 型チェック | `npm run typecheck` |
| テスト | `npm test` |
| Expo ヘルスチェック | `npm run doctor` |

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

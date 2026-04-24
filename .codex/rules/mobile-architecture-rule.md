# mobile アーキテクチャ規則

Puttokei mobile は Expo / React Native / TypeScript / Tamagui を使うモバイルアプリ。Expo Router の route と feature 単位の実装を分離する。

## 使用アーキテクチャ

- Expo Router によるファイルベースルーティングを採用する
- `app/` は route と layout のみ。画面本体や feature logic は置かない
- 画面、hooks、components、API 呼び出しは `src/features/<feature>` に機能単位でまとめる
- 共通 component、API client、Firebase、notification、Zustand store、共有 type は `src/shared` に置く
- サーバー状態は TanStack Query、ローカル状態は Zustand を使う
- フォームは React Hook Form + Zod を前提にする
- UI は Tamagui を前提にし、画面ごとの ad hoc な共通部品化を避ける

## ディレクトリ構成

```text
mobile/
├── app/
│   ├── _layout.tsx          # Tamagui / TanStack Query Provider など root layout
│   ├── (auth)/              # 認証、概要、チュートリアル route
│   ├── (tabs)/              # ホーム、履歴、統計、設定、session phase route
│   ├── history/             # 履歴詳細 route
│   └── profile/             # profile 編集 route
├── src/
│   ├── features/
│   │   ├── auth/            # 認証、チュートリアル
│   │   ├── session/         # input / output / break / result、timer、session API
│   │   ├── history/         # 判定履歴
│   │   ├── stats/           # 統計
│   │   ├── settings/        # 設定、アカウント削除
│   │   └── profile/         # profile 表示・更新
│   └── shared/
│       ├── components/      # 共通 UI
│       ├── hooks/           # 機能横断 hook
│       ├── lib/             # API client / Firebase / QueryClient / notification
│       ├── stores/          # Zustand store
│       └── types/           # API と共有 domain type
├── assets/
├── plugins/
├── app.json
├── eas.json
├── package.json
└── tamagui.config.ts
```

## feature ごとの責務

- `features/auth`: サインイン、チュートリアル、認証 API / hook
- `features/session`: input / output / break / result、timer、session API / hook
- `features/history`: 判定履歴一覧と詳細
- `features/stats`: 統計 API、chart、period selector
- `features/settings`: 設定取得・更新、アカウント削除
- `features/profile`: profile 表示・更新
- `shared/components`: 複数 feature で使う UI
- `shared/lib`: API client、Firebase、notification、QueryClient など外部接続や初期化
- `shared/stores`: Zustand store
- `shared/types`: backend contract と対応する共有型

## 実装ルール

- `app/**/*.tsx` は `src/features/*/screens` の component を import して route として公開するだけにする
- feature 内では必要なものだけ `screens` `components` `hooks` `api` `types` を作る
- feature 間で共有したくなったものは、特定 feature の都合でなければ `src/shared` へ移す
- API 呼び出しは `src/shared/lib/api.ts` の共通 client を経由する
- backend の enum や schema と対応する型は `src/shared/types` または該当 feature の `types.ts` に明示する
- TanStack Query の query key は feature ごとに安定したキーを使う
- Zustand store は永続化の有無と初期化タイミングを明示する

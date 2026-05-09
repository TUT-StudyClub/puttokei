# Mobile Build and Release

このドキュメントは mobile のビルド、TestFlight submit、ローカル実機ビルドの運用をまとめる。

## このブランチで変わった運用

- `app.json.example` は Git 管理するテンプレートとして扱う。`YOUR_*` プレースホルダは残す。
- `app.json` は Git 管理外のローカル overlay として扱う。必要なら `app.json.example` をコピーして実値を入れる。
- `.env.example` は Git 管理するテンプレートとして扱う。具体値は書かない。
- `.env.local` は Git 管理外のローカル設定として扱う。通常のローカル開発は `.env.local` で上書きする。
- EAS Build / Submit に必要な共通値は Git に置かず、Slack / Notion / 1Password / EAS Cloud env などで管理する。
- `ascAppId` は `eas.json` にコミットしない。実行時に `ASC_APP_ID` から一時注入し、コマンド終了後に元へ戻す。
- `eas-cli` は project の devDependency に入れない。必要なときは `npx --package=eas-cli --yes -- eas ...` 経由で使う。
- `app.json` と `GoogleService-Info*.plist` は `.gitignore` では除外するが、EAS Build の archive には含める。

## 共通の事前確認

mobile ディレクトリで実行する。

```bash
task install
```

ビルド前に CI 相当のチェックを通す。

```bash
task ci
```

`task ci` は repository root から実行する。mobile だけ確認する場合は次を使う。

```bash
task mobile:ci
```

## パターン 1: TestFlight 向けに EAS Build / Submit する

### 使う profile

| 用途                         | build profile | submit profile | Bundle ID            | App Store Connect App |
| ---------------------------- | ------------- | -------------- | -------------------- | --------------------- |
| TestFlight 内部 / 外部テスト | `preview`     | `preview`      | `com.hourglass.stg`  | staging 用 app        |
| App Store 公開               | `production`  | `production`   | `com.hourglass.prod` | production 用 app     |

### EAS / Apple 側に必要な値

EAS Build 時に `app.config.js` が次の値を必須チェックする。Git には置かない。

```text
EXPO_PUBLIC_APPLE_TEAM_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME
EXPO_PUBLIC_EAS_PROJECT_ID
EXPO_PUBLIC_EAS_OWNER
```

これらは次のどちらかで渡す。

- EAS Cloud env に登録する
- Git 管理外の `mobile/app.json` に実値を入れて EAS archive に含める

`ASC_APP_ID` は submit 時だけローカル環境変数で渡す。`eas.json` には残さない。

```bash
ASC_APP_ID=<staging の App Store Connect App ID>
```

### TestFlight へ build して自動 submit する

通常はこのコマンドを使う。

```bash
ASC_APP_ID=<staging の App Store Connect App ID> npm run eas:build:ios:auto-submit -- --profile preview
```

`eas.json` に一時的に `submit.preview.ios.ascAppId` が入るが、正常終了時に自動で戻る。実行中の差分はコミットしない。

コマンド終了後に確認する。

```bash
git diff -- eas.json
```

差分が残っている場合、`ascAppId` の一時注入が復元されていない。最終形は次の状態に戻す。

```json
"submit": {
  "preview": {},
  "production": {}
}
```

### Build は成功したが submit だけ失敗した場合

同じ build を submit し直す。

```bash
ASC_APP_ID=<staging の App Store Connect App ID> npm run eas:submit:ios:latest -- --profile preview
```

`--latest` は最新の iOS build を拾う。別 build が後から走っている場合は、EAS dashboard で対象 build を確認してから実行する。

### version を上げて出す

App Store Connect 上の `0.1.0 (8)` のような組み合わせは再利用できない。同じ version で build number が重複した場合は、新しい build を作る。

アプリの表示 version を上げる場合は、次を変更する。

- `mobile/app.json.example` の `expo.version`
- Git 管理外の `mobile/app.json` を使っている場合は、その `expo.version`

例:

```json
"version": "0.1.1"
```

その後に build / submit する。

```bash
ASC_APP_ID=<staging の App Store Connect App ID> npm run eas:build:ios:auto-submit -- --profile preview
```

`preview` / `production` は `autoIncrement: true` なので、iOS build number は EAS が自動で増やす。

### TestFlight 外部配布

EAS Submit が成功した後は App Store Connect で操作する。

1. App Store Connect の対象 app を開く。
2. `TestFlight` を開く。
3. `External Testing` の group を作成する。
4. group に build を追加する。
5. `What to Test` と `Test Information` を入力する。
6. `Submit Review` で Beta App Review に出す。
7. 承認後、メール招待または public link で外部テスターへ配布する。

外部テストは Apple の Beta App Review が入る。初回は特に時間がかかることがある。

## パターン 2: ローカルで自分の実機に直接 build する

TestFlight を使わず、Mac に接続した iPhone へ直接インストールして確認する手順。

### ローカル設定を作る

mobile ディレクトリで実行する。

```bash
cp .env.example .env.local
```

`.env.local` の `EXPO_PUBLIC_*` を埋める。空欄は未指定扱いになる。

最低限よく使う項目:

```text
EXPO_PUBLIC_API_BASE_URL=http://<Mac の LAN IP>:8080/api/v1
EXPO_PUBLIC_BUNDLE_IDENTIFIER=com.hourglass.dev.<your-name>
EXPO_PUBLIC_GOOGLE_SERVICES_IOS=./GoogleService-Info.dev.<your-name>.plist
EXPO_PUBLIC_APPLE_TEAM_ID=<自分の Apple Team ID>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<共有された Google Web client ID>
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=<自分の plist の REVERSED_CLIENT_ID>
EXPO_PUBLIC_EAS_PROJECT_ID=<共有された EAS project ID>
EXPO_PUBLIC_EAS_OWNER=<共有された Expo owner>
```

Firebase Console で自分の Bundle ID 用の iOS App を登録し、`GoogleService-Info*.plist` を mobile 直下に置く。

複雑な config を上書きしたい場合だけ `app.json` を作る。

```bash
cp app.json.example app.json
```

`app.json` は Git 管理外。必要な実値だけ入れる。

### backend を実機向けに起動する

repository root から実行する。

```bash
task backend:db:up
task backend:db:upgrade
task backend:dev:device
```

`EXPO_PUBLIC_API_BASE_URL` には `task backend:dev:device` を起動している Mac の LAN IP を使う。

### Metro を development build 向けに起動する

別 terminal で repository root から実行する。

```bash
task mobile:start:dev
```

キャッシュが怪しい場合:

```bash
cd mobile
npx expo start --dev-client -c
```

### iPhone へ直接 build / install する

USB で iPhone を接続し、Developer Mode と信頼設定を済ませる。

CLI で入れる場合:

```bash
cd mobile
npx expo run:ios --device
```

Xcode で入れる場合:

```bash
cd mobile
npx expo prebuild -p ios
open ios/Hourglass.xcworkspace
```

Xcode で次を確認する。

- target の Team が自分の Apple account になっている
- Bundle Identifier が `.env.local` / `app.json` と一致している
- 実機が run destination に選択されている

その後、Xcode の Run ボタンで build / install する。

## よくある失敗

### `Read app config` で `YOUR_*` が残っている

EAS Build 時に必須値が未設定。EAS Cloud env または `mobile/app.json` に実値を入れる。

### submit で `ASC App ID` が見つからない

`ASC_APP_ID` が対象 Bundle ID の App Store Connect App ID と一致していない。

- `preview`: `com.hourglass.stg` の App Store Connect App ID
- `production`: `com.hourglass.prod` の App Store Connect App ID

### `Build number ... has already been used`

同じ version 内で同じ build number は再 submit できない。新しい EAS Build を作る。

```bash
ASC_APP_ID=<staging の App Store Connect App ID> npm run eas:build:ios:auto-submit -- --profile preview
```

### 画像提出が 503 になる

backend の GCS 画像アップロード機能が Cloud Run 環境で有効化されていない。`GCS_OUTPUT_IMAGE_BUCKET` など backend 側の設定と IAM を確認する。

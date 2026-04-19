# 動作確認するまでのセットアップ

## 0. 環境のインストール

ルートディレクトリで実行

```bash
task install
```

## 1. mobile側のセットアップ

コマンドはmobileディレクトリで実行

### 1-1. app.json を作成する

`mobile/app.json` は `apiBaseUrl` や `bundleIdentifier`など個人ごとに異なる値を含むため `.gitignore` 対象になっている。
初回 clone 時はテンプレートからコピーして作る。

```bash
cp app.json.example app.json
```

### 1-2. apiBaseUrlの編集

`ipconfig getifaddr en0` でアドレスを取得

app.jsonの中の`extra.apiBaseUrl` を書き換え

変更前
http://localhost:8080/api/v1

変更後
http://192.168.40.199:8080/api/v1

**これは接続しているwifiが変わるたびに変わるので注意**

### 1-3. bundleIdentifierの編集

exampleでは`com.hourglass-nomibress.app`となっている

真ん中の`hourglass-nomibress`を自分の名前に変えるのがおすすめ

### 1-4. Firebase の設定

Apple / Google サインインには Firebase が必要。次の 3 つをチームの Firebase
プロジェクト（例: `hourglass-f10ca`）から取得して mobile 直下に配置する。

1. **`GoogleService-Info.plist`** (iOS 用)
   - Firebase Console → プロジェクト設定 → アプリ → iOS アプリを選択 → `GoogleService-Info.plist` をダウンロード
   - `mobile/GoogleService-Info.plist` に配置（`.gitignore` 済み）
2. **`google-services.json`** (Android 用)
   - 同じプロジェクト設定 → Android アプリを選択 → `google-services.json` をダウンロード
   - `mobile/google-services.json` に配置（`.gitignore` 済み）
3. **`googleWebClientId`** (Google Sign In 用)
   - Firebase Console → プロジェクト設定 → Authentication → Google プロバイダを開く
   - 「ウェブ SDK の構成」セクションの「ウェブクライアント ID」をコピー
   - `mobile/app.json` の `extra.googleWebClientId` に貼り付け（`YOUR_GOOGLE_WEB_CLIENT_ID` を置換）

iOS の URL Scheme は `GoogleService-Info.plist` 内の `REVERSED_CLIENT_ID`
を使う。`app.json` の `@react-native-google-signin/google-signin` プラグイン
設定 `iosUrlScheme` を `YOUR_REVERSED_CLIENT_ID` → その値で置換する。

> Firebase の Swift Pod を扱うため `./plugins/withModularHeaders` という
> Expo config plugin を `app.json.example` に入れてある。`prebuild` 時に
> Podfile へ `modular_headers => true` を差し込むので手動操作は不要。

#### Apple サインインを有効にするには（Apple Developer Program 登録後）

コード側（`expo-apple-authentication` / `signInWithApple.ts` / `app.json` の
`ios.usesAppleSignIn: true`）はすでに配線済みなので、次の手順だけ踏めば実機
で動き出す。Apple Developer Program 未加入の間は iOS の「Apple でサインイン」
ボタンを押すと失敗するが、Google 側は影響を受けない。

1. [Apple Developer](https://developer.apple.com) で **App ID** を作成し、
   `mobile/app.json` の `ios.bundleIdentifier` と一致させる。`Sign in with
Apple` capability を有効にする。
2. **Services ID** を作成（Web 側の OAuth 識別子）。戻りの URL には
   Firebase Console が提示する `https://<project>.firebaseapp.com/__/auth/handler`
   を登録する。
3. **Key** を作成し `Sign in with Apple` を有効化 → `.p8` ファイルをダウンロード。
4. Firebase Console → Authentication → Sign-in method → **Apple** を有効化。
   - Services ID、Apple Team ID、Key ID、ダウンロードした `.p8` の中身を貼る。
5. `ios/` を再生成する。`usesAppleSignIn: true` から `entitlements` と
   capability が自動付与される。次のどちらかで実行する。
   - **差分 prebuild（推奨）**: `npx expo prebuild -p ios` で差分更新する。
     Xcode の独自設定や Signing 情報を保ったまま capability だけ追加される。
     反映されない場合は Xcode の Signing & Capabilities タブで
     `+ Capability` → **Sign in with Apple** を手動追加する。
   - **クリーン再生成**: `npx expo prebuild -p ios --clean` で `ios/` を
     全面再生成する。確実に設定が反映される代わりに **ローカルの `ios/`
     変更は全消去される** ので注意。手動で加えた Podfile 修正や Xcode 設定
     は事前に退避しておく。
6. Xcode の Signing & Capabilities で **Sign in with Apple** が付いていること
   を確認。
7. 実機ビルドして動作確認する。

### 1-5. ios ディレクトリを作成する

```bash
npx expo prebuild -p ios       # ios/ ディレクトリ生成
```

mobile直下にiosディレクトリがあることを確認

#### 1-5-a. CocoaPods の依存をインストールする(1-5.の失敗時のみ実行)

`prebuild` の末尾で自動実行されるが、失敗した場合や手動でやり直したい場合は以下を実行する。

```bash
cd ios
pod install
cd ..
```

- Apple Silicon (M1/M2/M3) で `pod install` が失敗する場合は `arch -x86_64 pod install` を試す
- CocoaPods が未インストールなら `brew install cocoapods` で導入する

### 注意事項

共有設定（`bundleIdentifier` / `plugins` / `experiments` など）を誰かが
更新した場合は `app.json.example` に反映される。手元の `app.json` にも
手動で差分を取り込むことを忘れないこと。

## 2. backendのセットアップ

全てのコマンドはbackendディレクトリで実行

### 2-1. backend/.envファイルの作成

```bash
cp .env.example .env
```

実機 Firebase ログインを検証するときは次の 2 点を編集する。dev テストユーザ
ログイン（`[dev] テストユーザーでログイン`）のみで動作確認する場合は
デフォルトのままで良い。

- `FIREBASE_PROJECT_ID` を **mobile と同じプロジェクト ID** に合わせる
  （例: `hourglass-f10ca`）。`GoogleService-Info.plist` 内の `PROJECT_ID`
  と一致していること。
- Firebase Admin SDK 用の credentials を用意する。次のどちらか:
  1. **Service account JSON (推奨)**: Firebase Console → プロジェクト設定 →
     サービスアカウント → 「新しい秘密鍵の生成」で JSON をダウンロードし、
     `backend/firebase-service-account.json` に保存 (`.gitignore` 済み)。
     `.env` に `FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json`
     を追記。
  2. **Application Default Credentials**: Firebase プロジェクトに直接アクセス
     権がある開発者は `gcloud auth application-default login` で済む
     （`FIREBASE_CREDENTIALS_PATH` は未設定のままで良い）。

## 3. dockerの起動

backend のローカル PostgreSQL は Docker Compose で起動する。

コマンド実行前にdocker desktopが起動していることを確認

実行場所は hourglass/backend

```bash
task db:up
task db:upgrade
```

実行後にdocker desktopでコンテナとイメージが作成されたことを確認

コマンドを実行して確認してもいい

```bash
docker ps
```

## 4. xcodeでの操作

xcode上で行う操作を写真付きで説明していくため、リモートリポジトリ上で見るかプレビュー表示することを推奨する

### 4-1. xcodeを開く

xcodeを開いた後画像一番下のOpen Existing ....を選択

![ホーム画面](../docs/setupPhoto/001_home.png)

フォルダ選択画面に進むので、下記パスのフォルダを選択し、開く

`/Hourglass/mobile/ios/Hourglass.xcworkspace`

間違っても.xcodeprojを選択しないよう注意

### 4-2. 署名設定

画面左のHourglassフォルダをダブルクリック

![ファイル選択](../docs/setupPhoto/002_fileSelect.png)

画面中央上部にタブが出てくるから、`Signing & Capabilities` を選択

![署名設定](../docs/setupPhoto/003_certificate.png)

以下の項目を設定

- Team: 個人の Apple アカウントを選択
- Bundle Identifier: `app.json` の `ios.bundleIdentifier` と一致させる

### 4-3 繋げる機器の設定

1. iphoneとmacを有線接続し、このデバイスを信頼するを選択(注：一瞬しか出ないことあるのでその場合は、コードを刺し直して、ボタンを押せるまで粘る)
2. iphoneで設定 > プライバシーとセキュリティ > デベロッパモードをオンにする

オンにした後再起動するよう促されるので従う

3. xcodeの画面中央最上部の機種名をクリックすると、デバイスを選択できる。ここで自分のiphoneを選択

![デバイス選択](../docs/setupPhoto/004_device.png)

## 5. もろもろ起動する

1. postgreSQLをdockerで起動。これは手順2で実行済みなのでスキップ

2. backend側

   実機 iPhone からアクセスできるように、LAN 向けで起動

   backendディレクトリで実行

   ```bash
   task dev:device
   ```

3. mobile側

   Metro を development build 向けに起動

   mobileディレクトリで実行

   ```bash
   task start:dev
   ```

初回やキャッシュ起因の不具合が出た場合はキャッシュをクリアして起動する。

```bash
cd mobile
npx expo start -c
```

## 6. build

iphoneとmacを有線接続して、同じwifiに接続

xcode上で右向きの三角ボタンを押すとbuildが始まる

初回ビルドは結構時間がかかるため、待機

### 6-2

buildが終わって、iphone上にアプリがあるのを確認

一番最初は信頼できないとかで開けないので設定を変える

設定 > 一般 > vpnとデバイス管理

アプリを選択して信頼するを選択

以上でセットアップは終了

## 7. 2回目以降の起動方法

### backend側

backendディレクトリで実行

```bash
task db:up          #dockerを落とした時のみ実行
task db:upgrade     #変更があった時のみ実行
task dev:device
```

### mobile側

mobileディレクトリで実行

```bash
task start:dev
```

### xcode側

三角ボタン押すだけ

## 8. 動作確認チェックリスト

- ルート (`/`) のタブが表示されるか
- サインイン画面 (`/(auth)/sign-in`) に遷移できるか
- セッション配下の `input` / `break` / `output` / `result` が表示されるか
- Metro のログに `ReferenceError: Property 'document' doesn't exist` が出ていないか

## トラブルシューティング

### `ReferenceError: Property 'document' doesn't exist` が出る

`metro.config.js` で `resolver.unstable_enablePackageExports = true` を設定していると、Tamagui などが Web 向けエントリに解決され、React Native 実行時に `document` 参照で落ちる。設定を外し、キャッシュをクリアして再起動する。

```bash
npx expo start -c
```

### Route が `missing the required default export` と警告される

上記の `document` エラーが発生していると、各ルートの default export も巻き添えで読み込めなくなり、この警告が大量に出る。原因のエラーを先に解消すれば警告も消える。

### `pod install` でビルドエラーになる

以下の順に試す。

```bash
cd ios
rm -rf Pods Podfile.lock
pod repo update
pod install
```

それでも解消しない場合は `npx expo prebuild -p ios --clean` で `ios/` を再生成する（ローカルの変更は失われるため注意）。

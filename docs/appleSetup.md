# Apple / Firebase セットアップ引き継ぎメモ

ファイル名: `appleSetup.md`

## 0. 前提

Hourglass iOS アプリでは、以下の3環境の Bundle ID で統一する。

| 環境 | Bundle ID | Firebase iOS App |
|---|---|---|
| dev | `com.hourglass.dev` | `Hourglass iOS Dev` |
| staging | `com.hourglass.stg` | `Hourglass iOS Staging` |
| production | `com.hourglass.prod` | `Hourglass iOS Prod` |

以後、Apple Developer / Firebase / Expo / Xcode / App Store Connect では、上記3つの Bundle ID を正とする。

過去に Firebase 上へ作成した可能性がある以下のアプリは、今後の正式運用では使わない。

```text
com.tutstudy.hourglass.dev
com.tutstudy.hourglass.goda.dev
```

削除は必須ではないが、`GoogleService-Info.plist` の取得対象や APNs Key の設定対象を間違えないこと。

---

## 1. ここまで完了した作業

### 1.1 Apple Developer Program

Apple Developer Program は Individual プランで加入済み。

確認済み情報:

| 項目 | 値 |
|---|---|
| Team ID | `58MG94QP2P` |
| Entity Type | Individual |
| 利用方針 | Individual のため、Apple Developer Team に他メンバーは追加しない。TestFlight 配布は App Store Connect ユーザー / 内部テスターを使う。 |

---

### 1.2 Apple Developer: App ID / Bundle ID

Apple Developer の `Certificates, Identifiers & Profiles > Identifiers` で、以下3つの App ID を使う方針。

| 環境 | App ID / Bundle ID | 必要 Capability |
|---|---|---|
| dev | `com.hourglass.dev` | Sign in with Apple / Push Notifications |
| staging | `com.hourglass.stg` | Sign in with Apple / Push Notifications |
| production | `com.hourglass.prod` | Sign in with Apple / Push Notifications |

Sign in with Apple の構成:

| Bundle ID | 設定 |
|---|---|
| `com.hourglass.prod` | Primary App ID |
| `com.hourglass.dev` | Grouped with `com.hourglass.prod` |
| `com.hourglass.stg` | Grouped with `com.hourglass.prod` |

Push Notifications は3つすべてで有効化する。

---

### 1.3 Apple Developer: Sign in with Apple 用 Services ID

Firebase Authentication の Apple プロバイダ用に Services ID を作成する。

推奨値:

```text
Services ID: com.hourglass.signin
```

設定内容:

| 項目 | 値 |
|---|---|
| Primary App ID | `com.hourglass.prod` |
| Domains and Subdomains | Firebase Authentication の auth domain |
| Return URLs | `https://<firebase-auth-domain>/__/auth/handler` |

例:

```text
Domains and Subdomains:
<project-id>.firebaseapp.com

Return URLs:
https://<project-id>.firebaseapp.com/__/auth/handler
```

注意:

- Domains には `https://` を付けない。
- Return URL には `https://` を付ける。
- 末尾スラッシュの有無は Firebase 側の表示と一致させる。

---

### 1.4 Apple Developer: Sign in with Apple Key

Apple Developer の `Certificates, Identifiers & Profiles > Keys` で Sign in with Apple 用 Key を発行済み、または発行対象。

用途:

| Key | 用途 | Firebase 登録先 |
|---|---|---|
| Sign in with Apple Key | Apple ログイン | Firebase Authentication > Sign-in method > Apple |

保管すべきもの:

| 項目 | 説明 |
|---|---|
| `.p8` ファイル | ダウンロードは1回のみ |
| Key ID | Firebase Apple プロバイダに入力 |
| Team ID | `58MG94QP2P` |
| Services ID | `com.hourglass.signin` |

注意:

- APNs Key と混同しない。
- リポジトリに commit しない。
- 1Password / Bitwarden 等で保管する。

---

### 1.5 Apple Developer: APNs Key

Apple Developer の `Certificates, Identifiers & Profiles > Keys` で APNs 用 Key を作成。

Key Name:

```text
Hourglass APNs Key
```

有効化した Capability:

```text
Apple Push Notifications service (APNs)
```

Configure で指定した内容:

| 項目 | 値 |
|---|---|
| Environment | Sandbox & Production |
| Key Restriction | Team Scoped / All Topics |

用途:

| Key | 用途 | Firebase 登録先 |
|---|---|---|
| APNs Key | iOS プッシュ通知 / FCM | Firebase Project Settings > Cloud Messaging > Apple app configuration |

保管すべきもの:

| 項目 | 説明 |
|---|---|
| APNs `.p8` ファイル | `AuthKey_XXXXXXXXXX.p8` |
| APNs Key ID | ファイル名の `XXXXXXXXXX` 部分と一致することが多い |
| Team ID | `58MG94QP2P` |

注意:

- Sign in with Apple 用 `.p8` とは別物。
- App Store Connect API Key とも別物。
- リポジトリに commit しない。

---

### 1.6 Firebase: iOS アプリ追加

Firebase Console の対象プロジェクトに、以下3つの iOS アプリを追加する。

| 環境 | Firebase iOS App | Bundle ID |
|---|---|---|
| dev | `Hourglass iOS Dev` | `com.hourglass.dev` |
| staging | `Hourglass iOS Staging` | `com.hourglass.stg` |
| production | `Hourglass iOS Prod` | `com.hourglass.prod` |

Firebase iOS アプリ追加時の入力:

| 項目 | 入力 |
|---|---|
| Apple bundle ID | 上記 Bundle ID |
| アプリのニックネーム | `Hourglass iOS Dev` / `Hourglass iOS Staging` / `Hourglass iOS Prod` |
| App Store ID | 空欄でよい |

`App Store ID` は正式公開後、必要に応じて後から設定する。

---

### 1.7 Firebase: GoogleService-Info.plist

Firebase からダウンロードされるファイル名はすべて `GoogleService-Info.plist` なので、リポジトリ内では環境別にリネームして管理する。

推奨配置:

```text
mobile/firebase/GoogleService-Info.dev.plist
mobile/firebase/GoogleService-Info.stg.plist
mobile/firebase/GoogleService-Info.prod.plist
```

対応関係:

| 環境 | Bundle ID | plist |
|---|---|---|
| dev | `com.hourglass.dev` | `GoogleService-Info.dev.plist` |
| staging | `com.hourglass.stg` | `GoogleService-Info.stg.plist` |
| production | `com.hourglass.prod` | `GoogleService-Info.prod.plist` |

注意:

- iOS ネイティブプロジェクトに最終的に入る名前は `GoogleService-Info.plist`。
- Expo の `app.config.ts` 側で `APP_ENV` に応じて `googleServicesFile` を切り替える。
- `.plist` は秘密鍵ではないが、プロジェクト情報と API Key を含む。チーム方針に応じて Git 管理するか Secret 管理するか決める。

---

### 1.8 Firebase Authentication: Apple Provider

Firebase Console で以下を設定する。

場所:

```text
Firebase Console
> Authentication
> Sign-in method
> Apple
```

入力値:

| Firebase 項目 | Apple Developer 側の値 |
|---|---|
| Services ID | `com.hourglass.signin` |
| Apple Team ID | `58MG94QP2P` |
| Key ID | Sign in with Apple Key の Key ID |
| Private Key | Sign in with Apple 用 `.p8` の中身 |

注意:

- ここに APNs Key を入れない。
- ここは Apple ログイン用。

---

### 1.9 Firebase Cloud Messaging: APNs Key

Firebase Console で APNs Key をアップロード済み、またはアップロード対象。

場所:

```text
Firebase Console
> プロジェクトの設定
> Cloud Messaging
> Apple アプリ
> 対象の iOS アプリ
> APNs 認証キー
```

対象アプリ:

```text
com.hourglass.dev
com.hourglass.stg
com.hourglass.prod
```

Firebase 画面上には、各 iOS アプリごとに以下2つの APNs 認証キー欄がある。

```text
開発用 APNs 認証キー
本番環境用 APNs 認証キー
```

実施内容:

```text
3アプリ × 2環境 = 合計6回アップロード
```

アップロードするものは6回とも同じ。

| 入力項目 | 値 |
|---|---|
| APNs 認証キー | Apple Developer で作成した `Hourglass APNs Key` の `.p8` |
| キー ID | APNs Key の Key ID |
| チーム ID | `58MG94QP2P` |

APNs 証明書について:

```text
APNs 認証キー: 使用する
APNs 証明書: 使用しない
```

下側の `APNs 証明書` 欄は古い証明書方式用なので、今回はアップロード不要。

---

## 2. ここまでの重要な設計判断

### 2.1 Bundle ID は `com.hourglass.*` に統一

今後、以下を正とする。

```text
dev:  com.hourglass.dev
stg:  com.hourglass.stg
prod: com.hourglass.prod
```

Codex は、既存コード・設定ファイル・ドキュメント内に古い Bundle ID が残っていないか確認し、必要に応じて修正すること。

検索対象例:

```bash
grep -R "com.tutstudy.hourglass" -n .
grep -R "com.hourglass" -n .
```

---

### 2.2 Apple Sign In は prod を Primary にする

Apple Developer 側では以下の関係を維持する。

```text
Primary: com.hourglass.prod
Grouped: com.hourglass.dev
Grouped: com.hourglass.stg
```

Expo / Xcode 側でも `usesAppleSignIn: true` を有効化し、iOS Capability と整合させる。

---

### 2.3 プッシュ通知は FCM + APNs Key 方式

プッシュ通知は Firebase Cloud Messaging を使う。

Apple 側では Push Notifications Capability と APNs Key を用意済み。  
Firebase 側では APNs Key を各 iOS アプリの開発用・本番用に登録する。

アプリ側では FCM token を取得し、バックエンドへ保存する必要がある。

---

## 3. これから Codex に実施してほしい作業

### 3.1 app.config.ts の環境切替

`mobile/app.config.ts` または Expo 設定ファイルで、`APP_ENV` に応じて Bundle ID と `GoogleService-Info.plist` を切り替える。

期待仕様:

| APP_ENV | Bundle ID | googleServicesFile |
|---|---|---|
| `dev` | `com.hourglass.dev` | `./firebase/GoogleService-Info.dev.plist` |
| `stg` | `com.hourglass.stg` | `./firebase/GoogleService-Info.stg.plist` |
| `prod` | `com.hourglass.prod` | `./firebase/GoogleService-Info.prod.plist` |

実装例:

```ts
const APP_ENV = process.env.APP_ENV ?? "dev";

const bundleIdentifierMap = {
  dev: "com.hourglass.dev",
  stg: "com.hourglass.stg",
  prod: "com.hourglass.prod",
} as const;

const googleServicesFileMap = {
  dev: "./firebase/GoogleService-Info.dev.plist",
  stg: "./firebase/GoogleService-Info.stg.plist",
  prod: "./firebase/GoogleService-Info.prod.plist",
} as const;

const bundleIdentifier =
  bundleIdentifierMap[APP_ENV as keyof typeof bundleIdentifierMap] ??
  bundleIdentifierMap.dev;

const googleServicesFile =
  googleServicesFileMap[APP_ENV as keyof typeof googleServicesFileMap] ??
  googleServicesFileMap.dev;
```

Expo 設定に入れるべき iOS 項目:

```ts
ios: {
  bundleIdentifier,
  googleServicesFile,
  supportsTablet: true,
  usesAppleSignIn: true,
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
  },
}
```

---

### 3.2 Expo plugins の確認

Apple Sign In と Firebase / Messaging のために、必要な plugin / package を確認する。

想定パッケージ:

```bash
cd mobile
npx expo install expo-apple-authentication
npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/messaging
npx expo install @react-native-google-signin/google-signin
```

既に入っている場合は追加不要。

Expo config の plugins 例:

```ts
plugins: [
  "expo-apple-authentication",
  "@react-native-firebase/app",
  "@react-native-firebase/auth",
  "@react-native-firebase/messaging",
]
```

実際に必要な plugin 名・設定形式は、現在の Expo SDK / React Native Firebase のバージョンに合わせて確認すること。

---

### 3.3 Push Notifications Capability / Background Modes の反映

iOS で FCM を使うため、ネイティブ側に以下が反映される必要がある。

| Capability | 必須度 | 用途 |
|---|---|---|
| Push Notifications | 必須 | APNs / FCM 通知 |
| Background Modes > Remote notifications | 推奨 | バックグラウンド通知 / silent push 対応 |

Expo prebuild 後に Xcode で確認すること。

---

### 3.4 Firebase 初期化の確認

React Native Firebase を使う場合、iOS では通常 `GoogleService-Info.plist` が正しく組み込まれていれば Firebase app は初期化される。

Codex は以下を確認すること。

- `@react-native-firebase/app` が導入されているか
- `GoogleService-Info.*.plist` が `APP_ENV` に応じて正しく参照されるか
- `ios/` 生成後、対象 plist が `GoogleService-Info.plist` として組み込まれるか
- plist の Bundle ID と `ios.bundleIdentifier` が一致しているか

---

### 3.5 Apple Sign In 実装の確認

Apple Sign In は以下の構成を想定。

- `expo-apple-authentication` で Apple ID credential を取得
- `@react-native-firebase/auth` へ credential を渡す
- Firebase Auth の ID Token を取得
- バックエンド API へ `Authorization: Bearer <Firebase ID Token>` を付与して送信

Codex は以下を確認・実装すること。

- Apple Sign In ボタンが iOS のみ表示されるか
- `expo-apple-authentication` の利用可否チェックがあるか
- Firebase Auth credential へ正しく変換しているか
- 取得した Firebase ID Token を API クライアントへ渡しているか
- ログアウト処理が Firebase Auth とアプリ状態の両方をクリアするか

---

### 3.6 Google Sign-In 実装の確認

Google Sign-In は以下を確認する。

- `@react-native-google-signin/google-signin` が設定済みか
- `iosUrlScheme` が正しいか
- 環境ごとの `GoogleService-Info.*.plist` に含まれる `REVERSED_CLIENT_ID` と一致しているか
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` 等の環境変数と整合しているか

必要に応じて、`app.config.ts` で `iosUrlScheme` を環境変数から渡す。

例:

```ts
const GOOGLE_IOS_URL_SCHEME = process.env.GOOGLE_IOS_URL_SCHEME;

plugins: [
  [
    "@react-native-google-signin/google-signin",
    {
      iosUrlScheme: GOOGLE_IOS_URL_SCHEME,
    },
  ],
]
```

---

### 3.7 FCM token 取得処理の実装

クライアント側で通知許可を取得し、FCM token を取得する。

必要処理:

1. iOS 通知許可をリクエスト
2. APNs token / FCM token を取得
3. FCM token をバックエンドへ送信
4. token refresh を購読して、更新時に再送信
5. ユーザーがログアウトしたら token を削除または無効化

実装イメージ:

```ts
import messaging from "@react-native-firebase/messaging";

export async function registerForPushNotifications() {
  const authStatus = await messaging().requestPermission();

  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    return null;
  }

  const token = await messaging().getToken();
  return token;
}
```

token refresh:

```ts
messaging().onTokenRefresh(async (token) => {
  // TODO: backend に再登録
});
```

---

### 3.8 FCM token 登録 API の追加

要件定義では `users` テーブルに `fcm_token` があるが、将来的には複数端末対応を考慮し `user_devices` テーブルが望ましい。

MVP では以下のどちらか。

#### 案A: users に fcm_token を保存

```http
PATCH /api/v1/users/me/fcm-token
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json

{
  "fcm_token": "xxxxx",
  "platform": "ios"
}
```

#### 案B: user_devices を新設

推奨。

```sql
user_devices
- id
- user_id
- platform
- fcm_token
- device_name
- last_seen_at
- created_at
- updated_at
```

API 例:

```http
PUT /api/v1/users/me/devices/current
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json

{
  "platform": "ios",
  "fcm_token": "xxxxx",
  "device_name": "iPhone"
}
```

Codex は既存 DB 設計・実装状況に合わせて、MVP として最小変更で実装すること。

---

### 3.9 通知送信処理の追加

バックエンド / worker 側で Firebase Admin SDK を使い、FCM token 宛に通知を送信する。

送信の用途:

- フェーズ切替通知
- 判定完了通知
- リマインダー通知

実装観点:

- Firebase Admin SDK の初期化
- Secret Manager から Firebase Admin SDK の認証情報を読む
- FCM token へ notification payload を送る
- 無効 token の削除
- リトライ / エラーハンドリング
- Cloud Tasks との連携

---

### 3.10 iOS prebuild の再生成

Apple Sign In / Push Notifications / Firebase plist の設定変更後は、iOS ネイティブプロジェクトを clean で再生成する。

```bash
cd mobile
APP_ENV=dev npx expo prebuild -p ios --clean
```

その後、Xcode で開く。

```bash
open ios/Hourglass.xcworkspace
```

Xcode で確認すること:

| 項目 | 期待値 |
|---|---|
| Bundle Identifier | `APP_ENV` に応じて `com.hourglass.*` |
| Team | `58MG94QP2P` の Apple Developer Team |
| Sign in with Apple | 有効 |
| Push Notifications | 有効 |
| Background Modes | Remote notifications が必要に応じて有効 |
| GoogleService-Info.plist | 選択環境の plist が組み込まれている |

---

### 3.11 TestFlight ビルド

production 向け TestFlight ビルドは以下を使う。

```bash
cd mobile
APP_ENV=prod npx expo prebuild -p ios --clean
open ios/Hourglass.xcworkspace
```

Xcode で:

```text
Product > Archive > Distribute App > App Store Connect > Upload
```

または EAS を使う場合:

```bash
cd mobile
APP_ENV=prod eas build -p ios --profile production
eas submit -p ios --profile production
```

EAS 利用時は別途 App Store Connect API Key / EAS credentials が必要。

---

## 4. Codex に確認してほしいファイル候補

実際のリポジトリ構造に合わせて確認すること。

```text
mobile/app.config.ts
mobile/app.json
mobile/package.json
mobile/ios/
mobile/firebase/
mobile/src/
backend/
docs/
```

検索コマンド例:

```bash
grep -R "bundleIdentifier" -n mobile
grep -R "GoogleService-Info" -n mobile
grep -R "usesAppleSignIn" -n mobile
grep -R "expo-apple-authentication" -n mobile
grep -R "react-native-firebase" -n mobile
grep -R "messaging" -n mobile
grep -R "fcm" -ni .
grep -R "com.hourglass" -n .
grep -R "com.tutstudy.hourglass" -n .
```

---

## 5. 動作確認項目

### 5.1 dev 実機確認

```bash
cd mobile
APP_ENV=dev npx expo prebuild -p ios --clean
open ios/Hourglass.xcworkspace
```

確認:

- iPhone にインストールできる
- Bundle ID が `com.hourglass.dev`
- Firebase 初期化エラーが出ない
- Google Sign-In が動く
- Apple Sign-In が動く
- 通知許可ダイアログが出る
- FCM token が取得できる
- FCM token がバックエンドに保存される

---

### 5.2 staging TestFlight 確認

可能なら staging 用の TestFlight アプリを作る。  
ただし App Store Connect のアプリ登録は通常1つの Bundle ID に紐づくため、staging を別アプリとして TestFlight 配布するか、prod アプリの TestFlight だけで運用するかは別途判断する。

確認:

- TestFlight インストールできる
- Apple Sign-In が動く
- Google Sign-In が動く
- 通知が届く

---

### 5.3 production TestFlight 確認

```bash
APP_ENV=prod
```

確認:

- Bundle ID が `com.hourglass.prod`
- Firebase `GoogleService-Info.prod.plist` が使われる
- Apple Sign-In が動く
- Google Sign-In が動く
- FCM token が本番用として取得される
- TestFlight で通知が届く

---

## 6. 注意点

### 6.1 `.p8` は絶対に commit しない

以下を `.gitignore` に入れる。

```gitignore
AuthKey_*.p8
*.p8
```

対象:

- Sign in with Apple Key
- APNs Key
- App Store Connect API Key

---

### 6.2 GoogleService-Info.plist の Git 管理

`GoogleService-Info.plist` は秘密鍵ではないが、Firebase API Key や project id を含む。

方針を決めること。

#### 方針A: Git 管理しない

```gitignore
mobile/firebase/GoogleService-Info.*.plist
```

共有方法:

- 1Password
- Bitwarden
- Google Drive 限定共有
- EAS Secret
- README に取得手順を書く

#### 方針B: Git 管理する

小規模チームでは運用が楽。  
ただし Firebase Security Rules / API Key 制限 / App Check などの対策を別途検討する。

---

### 6.3 APNs Key と Apple Sign In Key を混同しない

| Key | 登録先 |
|---|---|
| Sign in with Apple `.p8` | Firebase Authentication > Apple |
| APNs `.p8` | Firebase Project Settings > Cloud Messaging |
| App Store Connect API `.p8` | EAS Submit / CI/CD |

---

### 6.4 Individual プランでも TestFlight 内部テスターは使える

Individual プランでも App Store Connect ユーザーは追加可能。  
ただし、追加ユーザーは Apple Developer Program のチームメンバーではない。

そのため:

- Developer Portal の Certificates / Identifiers / Profiles は触れない
- 共有 Bundle ID でローカル署名はできない
- App Store Connect 上の TestFlight 内部テスターとしては利用できる

デザイナーに触ってもらう場合は、まず TestFlight 内部テスターを使う。

---

## 7. Codex 向け最終タスク一覧

### 必須

- [ ] `com.hourglass.dev` / `com.hourglass.stg` / `com.hourglass.prod` に Bundle ID を統一
- [ ] 古い `com.tutstudy.hourglass*` がコードに残っていないか検索
- [ ] `APP_ENV` に応じて Bundle ID を切り替える
- [ ] `APP_ENV` に応じて `GoogleService-Info.*.plist` を切り替える
- [ ] `usesAppleSignIn: true` を設定
- [ ] Apple Sign In 実装を Firebase Auth に接続
- [ ] Google Sign-In 実装の `iosUrlScheme` を確認
- [ ] FCM token 取得処理を実装
- [ ] FCM token をバックエンドへ保存する API を実装
- [ ] iOS prebuild 後に Push Notifications Capability が入ることを確認
- [ ] iOS prebuild 後に Sign in with Apple Capability が入ることを確認
- [ ] dev 実機でログインと FCM token 取得を確認
- [ ] prod TestFlight でログインとプッシュ通知を確認

### 推奨

- [ ] `user_devices` テーブルを追加して複数端末対応
- [ ] FCM token refresh 対応
- [ ] 無効 token の削除処理
- [ ] Cloud Tasks と通知送信処理の連携
- [ ] EAS Build / Submit 用の設定整理
- [ ] App Store Connect 内部テスター運用手順を docs に追加

---

## 8. 完了状態の定義

この Apple / Firebase セットアップに関する完了条件は以下。

- [ ] `APP_ENV=dev` で iPhone 実機にインストールできる
- [ ] dev で Apple Sign-In が動く
- [ ] dev で Google Sign-In が動く
- [ ] dev で FCM token が取得できる
- [ ] dev でバックエンドに FCM token を保存できる
- [ ] `APP_ENV=prod` で TestFlight にアップロードできる
- [ ] TestFlight でデザイナーがインストールできる
- [ ] TestFlight で Apple Sign-In が動く
- [ ] TestFlight で Google Sign-In が動く
- [ ] TestFlight でプッシュ通知が届く

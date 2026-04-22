### 1. 本ドキュメントの目的と前提

#### 1.1. 目的

Hourglass の iOS 開発において、Apple Developer Program（以下 ADP）加入後にチームで運用するうえで必要な設定・操作を一箇所に集約することを目的とします。ローカル開発・Firebase 連携・TestFlight 配布・年次運用までを通しで追えるガイドとして運用します。

#### 1.2. 背景

これまで Hourglass では ADP に誰も加入していない状態で開発を進めており、各メンバーが無料の個人 Apple ID で署名し、`mobile/app.json` の `ios.bundleIdentifier` に個人名を埋め込んだ ID（例: `com.tutstudy.hourglass.goda.dev`）を使用して各自の実機に直接ビルドしていました。Firebase の `GoogleService-Info.plist` もメンバーごとに生成しており、Sign in with Apple は ADP 未加入のため実機で `AuthorizationError: 1000` を返して機能していませんでした。

今回、オーナー 1 名が **ADP の Individual プラン** に加入したため、次の状態に移行します。

- Sign in with Apple を正式に動作させる
- Bundle ID を個人別から **環境別 (dev / staging / production)** に統一する
- **TestFlight 外部テスター** 経由でチームメンバーにビルドを配布する

#### 1.3. 対象読者

| 読者 | 想定作業 |
| --- | --- |
| オーナー（ADP 加入者） | Apple Developer Portal / App Store Connect / Firebase Console の設定、TestFlight 提出 |
| チームメンバー | TestFlight 経由での動作確認、ローカル開発時の制約理解 |

#### 1.4. 関連ドキュメント

- [mobile/setup.md](../../mobile/setup.md): ローカル開発環境のセットアップ手順。Apple 関連の詳細は本ドキュメントに集約するため、いずれ当該節は本ドキュメントへの参照に差し替えます。
- [docs/requirements/requirements.md](../requirements/requirements.md): 技術選定・アーキテクチャの原典。Firebase Authentication と Apple Sign In の採用理由はこちらに記載しています。
- [.claude/skills/hourglass-project/references/contracts.md](../../.claude/skills/hourglass-project/references/contracts.md): 認証プロトコル（Firebase ID Token を `Authorization: Bearer` で送る契約）。

### 2. 用語集

| 用語 | 説明 |
| --- | --- |
| ADP（Apple Developer Program） | 年額 $99 の Apple 公式デベロッパー登録。App Store 配信・TestFlight・Sign in with Apple などに必須 |
| Team ID | ADP 加入時に発行される 10 文字の英数字。Xcode の `DEVELOPMENT_TEAM` や Firebase Apple OAuth に設定する |
| App ID | Bundle Identifier と Capability の組。Apple Developer Portal の Identifiers で登録する |
| Bundle Identifier | アプリ固有の識別子（例: `com.tutstudy.hourglass.dev`）。`mobile/app.json` の `ios.bundleIdentifier` に対応 |
| Services ID | Web ベースの OAuth 用 ID。Firebase の Apple プロバイダ連携で Services ID を設定する |
| Key（.p8） | Sign in with Apple / APNs 用の秘密鍵ファイル。発行時のみダウンロード可能、再発行は不可 |
| Signing Certificate | iOS Development / iOS Distribution の 2 種。実機ビルドや App Store 提出に必要 |
| Provisioning Profile | Bundle ID・証明書・デバイス・Capability をひとまとめにしたプロファイル。Xcode が自動生成する運用を推奨 |
| TestFlight | Apple が提供するベータ配布サービス。ビルドを最大 90 日間配信可能 |
| 内部テスター | App Store Connect の Users and Access に登録されたアカウント（＝ADP メンバー）。Individual プランでは自分以外を追加できない |
| 外部テスター | メールアドレスだけで招待できるテスター。初回ビルドは Apple のベータ審査（通常 24 時間以内）が必要 |

### 3. 採用する運用方針

#### 3.1. Bundle ID 体系（ハイブリッド運用）

Apple の仕様上、**Explicit な Bundle ID は 1 つの Apple Developer Team のみが登録できます**。オーナーの ADP Team で `com.tutstudy.hourglass.dev` を登録した時点で、他メンバーの無料個人 Team はその Bundle ID で署名できなくなります。そのため本プロジェクトでは、**オーナー専用の共有 Bundle ID 3 本**と、**メンバーごとに発行する個人ローカル Bundle ID** を併存させるハイブリッド運用を採用します。

| 分類 | Bundle ID | 登録 Team | 署名できる人 | 主な用途 |
| --- | --- | --- | --- | --- |
| 共有 (dev) | `com.tutstudy.hourglass.dev` | オーナー ADP Team | オーナーのみ | オーナーのローカル開発 / TestFlight dev 配信（任意） |
| 共有 (stg) | `com.tutstudy.hourglass.stg` | オーナー ADP Team | オーナーのみ | オーナーの受け入れ検証 / TestFlight 外部テスター検証 |
| 共有 (prod) | `com.tutstudy.hourglass` | オーナー ADP Team | オーナーのみ | App Store 配信 / TestFlight 本番 |
| 個人ローカル | `com.tutstudy.hourglass.{member}.local` | 各メンバーの無料個人 Team | そのメンバー本人のみ | メンバーの iPhone へ直接ビルドして開発 |

`{member}` にはメンバーを一意に識別する小文字英字（例: `goda`）を入れます。同一 iPhone に共有ビルドと個人ローカルビルドが共存しても、iOS からは別アプリとして扱われるため衝突しません。

切替は `APP_ENV`（`dev` / `stg` / `prod`）と `LOCAL_BUNDLE_SUFFIX`（個人識別子）の 2 つの環境変数で行います。`LOCAL_BUNDLE_SUFFIX` が設定されている場合は共有 Bundle ID より優先され、個人ローカルビルドになります（具体実装は「7. リポジトリ側で別タスクとして行う変更」参照）。

> **重要**: dev / stg / prod の 3 本だけでチーム全員がローカル開発を進めることは**できません**。これらで署名できるのはオーナーのみです。メンバーは個人 Bundle ID を別途用意して並行運用します。

#### 3.2. Team 運用

Individual プランのため、他メンバーを同一 Apple Developer Team に招待できません。オーナーが次の責務を一元的に担います。

- Apple Developer Portal の Identifiers / Keys / Certificates / Devices の管理
- App Store Connect のアプリ登録・TestFlight 運用
- Firebase Authentication の Apple プロバイダ設定
- リリースビルドのアーカイブと提出

#### 3.3. メンバーの動線

| 役割 | ローカルビルド時の Bundle ID | 署名 Team | 動作確認手段 | Apple Sign In |
| --- | --- | --- | --- | --- |
| オーナー | `com.tutstudy.hourglass.dev` | ADP Team (`34fhne349g`) | 自身の iPhone + TestFlight | 動作する |
| メンバー（ローカル） | `com.tutstudy.hourglass.{member}.local` | 各自の無料個人 Team | 各自の iPhone | **動作しない**（UI 側で非表示/無効化） |
| メンバー（TestFlight） | - | - | TestFlight アプリ | 動作する（オーナー Team で署名されたビルドを受け取るため） |

メンバーの典型的な開発サイクルは「ローカルで Google Sign In を使って画面とロジックを作る → TestFlight ビルドで Apple Sign In 含めたエンドツーエンド検証」の二段構えになります。

#### 3.4. Sign in with Apple の動作検証ポリシー

Sign in with Apple は ADP 加入済みの Team で署名された App ID でのみ動作します。Individual プランでは他メンバーをその Team に入れられないため、次のいずれかで検証します。

1. オーナー本人の実機で検証する（推奨）
2. オーナーが TestFlight 提出したビルドをメンバーが受け取り、メンバーの iPhone で検証する
3. メンバーが個人 Team で実機ビルドする場合は、Apple Sign In ボタンを非表示または無効化する設定で確認する

#### 3.5. Bundle ID / Team ID の制約の詳細

本プロジェクトで押さえておくべき Apple の制約と、その影響を整理します。

##### 3.5.1. Explicit Bundle ID は Team が占有する

オーナー ADP Team で `com.tutstudy.hourglass.dev` を登録すると、**他 Team では同じ Bundle ID を使えません**。メンバーが共有 Bundle ID で Xcode Run すると `Failed to register bundle identifier. The app identifier "com.tutstudy.hourglass.dev" is not available` のようなエラーが出ます。この衝突を避けるため、メンバーは必ず個人識別子付きの Bundle ID（`com.tutstudy.hourglass.{member}.local`）を使います。

##### 3.5.2. 無料個人 Team の制約

メンバーが無料 Apple ID で実機ビルドする際は以下の制約を受けます。

- Provisioning Profile は **7 日間で失効** します。失効後は Xcode から再度 Run すれば自動再発行されます。
- 同一 Apple ID で登録できる実機は **3 台まで** です。
- **Sign in with Apple / Push Notifications / In-App Purchase などの Paid Capability は利用不可**。`usesAppleSignIn: true` のままビルドしても Apple Sign In はランタイムで失敗します。
- App Store / TestFlight への提出は不可。

##### 3.5.3. 証明書と Provisioning Profile は Team ごとに独立

オーナーの Apple Development Certificate と、メンバーの個人 Team の証明書は別物です。共有する必要はなく、各自の macOS キーチェーン内で独立して管理されます。オーナーから証明書や `.p12` を共有する必要はありません。

##### 3.5.4. TestFlight ビルドは例外的に Apple Sign In が動く

TestFlight で配布されるビルドは**オーナーの ADP Team で署名された成果物**です。インストール先が別 Apple ID の iPhone であっても、ビルド自体の署名は変わらないため Sign in with Apple は正常に動きます。「メンバーのローカルビルドでは動かないが TestFlight では動く」という挙動差はここから来ています。

##### 3.5.5. `iosUrlScheme` は Bundle ID ごとに変わる

Google Sign In プラグインが要求する `iosUrlScheme`（`REVERSED_CLIENT_ID`）は、Firebase iOS アプリごとに一意です。Bundle ID が変わると値が変わるため、個人ローカルビルドでは各メンバー自身の `GoogleService-Info.{member}.local.plist` から取った値を使う必要があります。`app.config.ts` では環境変数 `GOOGLE_IOS_URL_SCHEME` から読む設計にします。

##### 3.5.6. Google Web Client ID は共通

Firebase プロジェクト全体で 1 つしかない Web OAuth Client ID のため、dev / stg / prod / 個人ローカルの**すべてで同じ値**を使い回せます。新しい Bundle ID を追加したからといって再取得する必要はありません。

##### 3.5.7. Firebase の Apple プロバイダ登録は共有アプリのみ

Firebase Authentication の Apple プロバイダ設定（Services ID / Team ID / Key / .p8）は Firebase プロジェクト全体に対して 1 回だけ行います。個人ローカル Bundle ID では Apple Sign In が動かない前提なので、**個人アプリに対して Apple 登録は不要**です。Google Sign In は Firebase プロジェクト全体で有効なので、個人アプリもそのまま Google 認証が動きます。

### 4. Apple Developer Portal 初期セットアップ（オーナー作業）

[Apple Developer](https://developer.apple.com/account) に ADP 加入済みの Apple ID でサインインして作業します。以下の画面構成は 2026 年 4 月時点のものです。レイアウト変更があった場合は同等のラベルを探して読み替えてください。

作業の全体像は次の通りです。4.1 → 4.2 → 4.3 → 4.4 → 4.5 の順で進めるのが前後関係として最も自然です。4.6 と 4.7 は必要に応じて後追いで実施します。

```text
4.1 Team ID 確認
  └→ 4.2 Signing Certificate 発行（Xcode Automatic を使うなら Xcode 内で自動化可）
      └→ 4.3 App IDs を 3 本作成（Sign in with Apple と Push Notifications を付与）
          └→ 4.4 Services ID 作成（Primary App ID = prod）
              └→ 4.5 Sign in with Apple 用 Key (.p8) 発行
                  └→（任意）4.6 Devices 登録 / 4.7 Provisioning Profiles
```

#### 4.1. Team ID とメンバーシップ情報の確認

##### 4.1.1. 手順

1. サインイン後、左サイドバー上部の **Membership details**（旧称 **Membership**）を開きます。
2. 次の値を確認し、パスワードマネージャに控えます。
   - **Team ID**: 10 文字の英数字。以降 Firebase / EAS / Xcode Signing で繰り返し使います。
   - **Entity Type**: `Individual` であること。
   - **Membership Status**: `Active`。
   - **Expiration Date**: 年次更新期限。**この日付の 30 日前** をカレンダーに登録しておきます（失効すると証明書・Provisioning Profile がすべて無効化されます）。
   - **Seller Name**: App Store 上で販売者として公開される表記。変更は審査経由になるため、ここで確認しておきます。
3. 右上のアバター → **View Account** を開き、名前・国・通貨が実態と合っていることを確認します。

##### 4.1.2. 確認のポイント

- Team ID は後述のすべての作業で必要です。`34fhne349g` のような見た目（数字と大文字英字の混在）になります。
- Individual でも **Account Holder** ロールが自分自身に付いていることが前提です（Organization 切替時にロール変更が必要になります）。

#### 4.2. Signing Certificate の発行

本プロジェクトでは Xcode の **Automatic Signing** を前提にします。通常は 4.7.1 の手順で Xcode が CSR 発行から `.cer` のインストールまで一括で済ませます。手動で発行したい場合のみ本節 4.2.2〜4.2.3 の手順を実施します。

##### 4.2.1. 発行する 2 種

| 種類 | 用途 | 有効期限 |
| --- | --- | --- |
| Apple Development | ローカル実機ビルド | 1 年 |
| Apple Distribution | App Store 提出 / TestFlight | 1 年 |

##### 4.2.2. CSR（Certificate Signing Request）の作成

1. macOS の **キーチェーンアクセス**（Finder → アプリケーション → ユーティリティ → キーチェーンアクセス）を起動します。
2. メニューバー: **キーチェーンアクセス → 証明書アシスタント → 認証局に証明書を要求…** を選択します。
3. フォームに入力します。
   - **ユーザのメールアドレス**: ADP 登録メール
   - **通称**: 任意（例 `Hourglass Developer`）
   - **CA のメールアドレス**: 空欄
   - **要求の処理**: **ディスクに保存** を選択
   - **鍵ペア情報を指定**: チェック（RSA / 2048 bit のまま）
4. 保存先を指定すると `CertificateSigningRequest.certSigningRequest` が生成されます。

##### 4.2.3. Apple Developer Portal で証明書を発行

1. サイドバー **Certificates, Identifiers & Profiles** → **Certificates** を開きます。
2. 右上「+」を押します。
3. **Apple Development** を選択 → **Continue**。
4. **Choose File** で 4.2.2 の `.certSigningRequest` をアップロード → **Continue**。
5. **Download** を押すと `.cer` ファイルが取得できます。ダブルクリックするとログインキーチェーンにインストールされます。
6. 同じ手順で **Apple Distribution** も発行します。CSR は 4.2.2 のものを再利用できます。

#### 4.3. App IDs の作成（3 本）

App ID は「Bundle ID ＋ 付与する Capability」の登録です。本プロジェクトでは共有 3 本のみを登録します。個人ローカル Bundle ID（`com.tutstudy.hourglass.{member}.local`）は**ここに登録しないでください**。登録するとオーナー ADP Team に占有されてしまい、メンバーが自分の無料 Team で署名できなくなります（3.5.1 参照）。

##### 4.3.1. 登録する 3 件

| Description | Bundle ID | 種別 |
| --- | --- | --- |
| Hourglass Dev | `com.tutstudy.hourglass.dev` | Explicit |
| Hourglass Staging | `com.tutstudy.hourglass.stg` | Explicit |
| Hourglass | `com.tutstudy.hourglass` | Explicit |

##### 4.3.2. Sign in with Apple の Primary / Grouped 構成

Sign in with Apple には「Primary App ID」と「Grouped App ID」の概念があります。1 つの Primary に複数の App ID をグループ化することで、**同一 Services ID と Key (.p8) で全ての Bundle ID をカバー** できます。本プロジェクトでは次の構成にします。

| 役割 | Bundle ID |
| --- | --- |
| Primary | `com.tutstudy.hourglass`（prod） |
| Grouped | `com.tutstudy.hourglass.dev` |
| Grouped | `com.tutstudy.hourglass.stg` |

この構成には次の利点があります。

- 4.4 の **Services ID** と 4.5 の **Key (.p8)** を 1 セットだけ作成すれば、3 つの Bundle ID すべての Sign in with Apple が動きます。
- Apple のユーザ識別子（`sub`）が Primary グループ内で共通になります。dev でログインしたユーザは stg / prod でも同じ Firebase ユーザとして扱われます（環境間で同一人物として検証しやすくなる）。

##### 4.3.3. 作成手順

**登録順序は prod → dev → stg の順を厳守** してください。Primary が未登録だと dev / stg を Grouped に指定できません。

1. サイドバー **Certificates, Identifiers & Profiles → Identifiers** を開きます。
2. 画面左上のプルダウンが **App IDs** になっていることを確認します。
3. 右上「+」を押します。
4. **Register a new identifier** で **App IDs** を選択 → **Continue**。
5. **Select a type** で **App** を選択 → **Continue**。
6. 次を入力します。
   - **Description**: 上表の値
   - **Bundle ID**: **Explicit** ラジオを選び、上表の値
7. ページ下部 **Capabilities** セクションで次にチェックを入れます。
   - **Sign In with Apple**: チェックを入れると右側に **Edit** / **Configure** ボタンが現れます。これを押して次を設定します。
     - **prod**（`com.tutstudy.hourglass`）のとき: **Enable as a primary App ID** を選び **Save**
     - **dev / stg** のとき: **Group with an existing primary App ID** を選び、プルダウンで `com.tutstudy.hourglass` を選択して **Save**
   - **Push Notifications**: チェックのみ（APNs Key は FCM 導入時に別途作成）
8. **Continue** → サマリ画面で **Register** を押します。
9. 残り 2 件も 1〜8 を繰り返します。

##### 4.3.4. 登録時の注意

- **prod を最初に登録** すること。dev / stg から作ると Primary の候補に出てこず、後で戻して修正する手間が発生します。
- 登録後に Primary / Grouped を切り替える場合は、Identifiers → 該当 App ID → Capabilities の **Sign In with Apple** 行で **Edit** を押すと変更できます。
- Bundle ID は登録後の**変更・削除が非常に困難**です。typo がないか Register 直前に必ず見直します。
- Sign in with Apple を後から有効化することもできますが、Entitlement 差分に対応するため `expo prebuild --clean` が必要になります。ここで有効化してしまう方が安全です。
- Push Notifications には Primary / Grouped の概念はありません。3 本すべてにチェックを入れるだけです。
- 3 本は別々の App ID なので、1 本作るごとにページを戻して再度「+」を押します。

#### 4.4. Services ID の作成

Firebase Authentication の Apple プロバイダは **Services ID** を受け付けます（App ID ではありません）。プロジェクト全体で **1 件** 作成すれば十分です。

##### 4.4.1. なぜ dev / stg / prod 用に 3 件作らないのか

4.3.2 で `com.tutstudy.hourglass`（prod）を Primary App ID として登録し、`dev` と `stg` を同じ Primary にグループ化しました。グループ化された App ID は同じ Services ID / Key を共有して Sign in with Apple を扱えます。

加えて、ネイティブ iOS の Sign in with Apple はアプリが直接 Apple に認証するため、Firebase に渡される ID トークンの `aud`（audience）は **Bundle ID そのもの**になります。Services ID が登場するのは Firebase が Web フォールバック（ブラウザ経由の認証）や Android で使う場合であり、iOS ネイティブフローでは主役ではありません。そのため、Services ID は Firebase プロジェクトに紐付く **1 件だけで 3 環境すべてを賄えます**。

##### 4.4.2. 作成手順

1. **Identifiers** 画面の左上プルダウンを **Services IDs** に切り替えます。
2. 右上「+」を押します。
3. **Register a new identifier** で **Services IDs** を選択 → **Continue**。
4. 次を入力します。
   - **Description**: `Hourglass Apple Sign In`
   - **Identifier**: `com.tutstudy.hourglass.signin`（任意値。ただし **Bundle ID と同じ値は使わない**）
5. **Continue** → **Register**。

##### 4.4.3. Sign in with Apple の Configure

1. 一覧から作成した Services ID（`com.tutstudy.hourglass.signin`）を開きます。
2. **Sign in with Apple** のチェックを入れ、右側に現れる **Configure** ボタンを押します。
3. モーダル **Web Authentication Configuration** で次を入力します。
   - **Primary App ID**: `com.tutstudy.hourglass`（prod。4.3.2 で Primary として登録したもの）
   - **Domains and Subdomains**: `hourglass-f10ca.firebaseapp.com`（`https://` は**付けない**）
   - **Return URLs**: `https://hourglass-f10ca.firebaseapp.com/__/auth/handler`（末尾スラッシュを**付けない**）
4. **Next** → **Done** → ページ下部の **Continue** → **Save** で確定します。

##### 4.4.4. よくあるつまずき

- Domains 欄に `https://` を付けると登録エラーになります。
- Return URL の末尾スラッシュ有無は Firebase 側の設定と完全一致させます（どちらか片方でもズレると `auth/invalid-credential` が出ます）。
- Primary App ID プルダウンに `com.tutstudy.hourglass` が出てこない場合、4.3.3 で **Primary として登録できていない** 可能性があります（Grouped のまま登録した、または App ID 未作成）。Identifiers で prod App ID を開き、Sign in with Apple を **Enable as a primary App ID** に切り替えます。
- dev / stg が prod にグループ化されていないと、dev / stg ビルドの Sign in with Apple 試行時に `invalid_client` 系エラーが出ます。Identifiers → 各 App ID → Sign In with Apple の Configure でグループ所属を確認します。

#### 4.5. Sign in with Apple 用 Key (.p8) の作成

Firebase に貼り付ける秘密鍵です。**ダウンロードは 1 回きり**で、Apple 側には保管されません。紛失した場合は Key ごと失効させて作り直します。

##### 4.5.1. 作成手順

1. サイドバー **Keys** を開きます。
2. 右上「+」を押します。
3. **Key Name** を入力します（例 `Hourglass Apple Sign In Key`）。
4. **Sign in with Apple** のチェックを入れ、右側 **Configure** を押します。
   - **他の Capability（Apple Push Notifications service (APNs) など）にはチェックを入れない** こと。この Key は Sign in with Apple 専用として運用し、APNs は FCM 導入時に別 Key として発行します（10.3 参照）。別ライフサイクルの Capability を同じ Key に同居させると、片方を revoke / ローテートしたときに他方まで巻き込む事故が起こります。
5. **Primary App ID** に `com.tutstudy.hourglass`（prod）を選択して **Save**。
6. **Continue** → **Register**。
7. 発行完了画面で **Key ID**（10 文字）をコピーして控えます。
8. **Download** ボタンを押し、`AuthKey_XXXXXXXXXX.p8`（XXXXXXXXXX が Key ID）を保存します。

##### 4.5.2. 保管

- 1Password / Bitwarden など信頼できるパスワードマネージャに次の 3 点をセットで保存します。
  - `.p8` ファイル本体
  - Key ID
  - 発行日（ローテーション判断の目安）
- ローカルの `~/Downloads` に置きっぱなしにしない。漏洩すると Apple ID Token を偽造される恐れがあります。
- リポジトリには**絶対に commit しない**（`.p8` は `.gitignore` に含まれている前提）。

##### 4.5.3. 紛失時の対処

1. **Keys** で該当 Key を開き **Revoke** します。
2. 4.5.1 の手順で新しい Key を発行します。
3. Firebase Console → Authentication → Sign-in method → Apple → Key ID と Private Key を新しい値で上書きします。
4. 既存ユーザのログインは影響を受けません（Refresh Token が無効化されるのは Apple 側でセッション切れが起きたときのみ）。

#### 4.6. Devices の登録（Ad Hoc 配布が必要になった場合のみ）

TestFlight 運用が基本方針なので通常は省略します。TestFlight を経由せずにメンバーの実機へ直接配布したい場合（例えば審査前に急いで手元確認したい場合）に実施します。

##### 4.6.1. UDID の取得（メンバー作業）

1. iPhone を Mac に Lightning / USB-C ケーブルで接続します。
2. Finder のサイドバーに表示される自分の iPhone を選択します。
3. 上部のサマリ行（容量・iOS バージョン等）を **1 回クリック** すると UDID（25〜40 文字の英数字）に表示が切り替わります。
4. 右クリック → **UDID をコピー** でクリップボードに入ります。
5. メンバーは UDID とデバイス名（例 `Goda iPhone 14 Pro`）をオーナーに送ります。

##### 4.6.2. 登録手順（オーナー作業）

1. サイドバー **Devices** を開きます。
2. 右上「+」を押します。
3. 次を入力します。
   - **Platform**: iOS, tvOS, watchOS
   - **Device Name**: わかりやすい名前（例 `Goda iPhone 14 Pro`）
   - **Device ID (UDID)**: メンバーから受領した値をペースト
4. **Continue** → **Register**。

##### 4.6.3. 注意点

- Individual プランの登録上限は **年間 100 台**です（iPhone / iPad / Mac / Apple TV / Apple Watch の合計）。
- 登録済みデバイスを削除しても当年度のカウントは戻りません。メンバーシップ更新時にリセットされます。
- 登録直後は Provisioning Profile の再生成が必要です（Xcode Automatic Signing なら次回ビルド時に自動更新）。

#### 4.7. Provisioning Profiles

Xcode の **Automatic Signing** を強く推奨します。手動作成は年次更新・メンバー追加のたびに負担が増え、ヒューマンエラーの温床になります。

##### 4.7.1. Automatic Signing（推奨）

1. Xcode で `mobile/ios/Hourglass.xcworkspace` を開きます。
2. プロジェクトナビゲータで **Hourglass** ターゲットを選択します。
3. **Signing & Capabilities** タブを開きます。
4. **Automatically manage signing** にチェックを入れます。
5. **Team** で ADP Team（Team ID `34fhne349g`）を選択します。初回は Xcode → **Settings → Accounts** で Apple ID を追加しておく必要があります。
6. **Bundle Identifier** が `com.tutstudy.hourglass.dev` など該当 App ID と一致していることを確認します。
7. Xcode が裏で Apple Developer Portal に問い合わせ、Development / Ad Hoc / App Store 用の Provisioning Profile を自動生成します。
8. 生成された `.mobileprovision` は `~/Library/MobileDevice/Provisioning Profiles/` に保管されます。
9. エラーが出た場合は警告行の **Try Again** または **Revoke and Request** を押します。

##### 4.7.2. 手動管理（必要時のみ）

1. **Profiles** を開き「+」を押します。
2. Type を選択します。
   - **iOS App Development**: ローカル実機ビルド用
   - **Ad Hoc**: UDID 登録済みデバイスに直接配布する用
   - **App Store**: TestFlight / App Store 提出用
3. App ID（`com.tutstudy.hourglass.dev` など）を選択。
4. Certificate（Development or Distribution）を選択。
5. Ad Hoc の場合は対象 Devices を複数選択。
6. **Profile Name** を入力（例 `Hourglass Dev Development`）。
7. **Generate** → **Download**。
8. `.mobileprovision` をダブルクリックで Xcode にインストール、または Xcode → Settings → Accounts → **Download Manual Profiles** で反映します。

##### 4.7.3. 年次の挙動

- Apple Development / Distribution 証明書が 1 年で失効すると、それに紐づく Provisioning Profile も無効になります。
- Automatic Signing を使っていれば、次回 Run 時に Xcode が **Revoke and Request** を促し自動復旧します。
- 手動管理の場合は Portal で 1 件ずつ再生成します。

### 5. App Store Connect でのアプリ作成

[App Store Connect](https://appstoreconnect.apple.com/) で作業します。

#### 5.1. アプリの新規登録

1. **マイ App** → 右上「+」→ **新規 App** を選択します。
2. 次を入力します。
   - プラットフォーム: iOS
   - 名前: `Hourglass`（App Store 表示名。後で変更可）
   - プライマリ言語: 日本語
   - Bundle ID: `com.tutstudy.hourglass`（4.3 で登録した prod App ID を選択）
   - SKU: `hourglass-ios-prod`（任意の内部識別子）
   - ユーザーアクセス: フルアクセス

#### 5.2. 最低限のメタデータ

TestFlight の外部テスター審査を通すには以下の項目が必要です。すべて **App Store Connect → マイ App → Hourglass** を開いた後の左サイドバーから入力します。

##### 5.2.1. 入力箇所の早見表

| 項目 | 入力場所（左サイドバーの順） | 必須タイミング |
| --- | --- | --- |
| カテゴリ（プライマリ / セカンダリ） | **App 情報** → 「一般情報」 | 外部テスター初回審査前 |
| プライバシーポリシー URL | **App 情報** → 「一般情報」 | 外部テスター初回審査前 |
| 年齢区分 | **App 情報** → 「年齢区分」 | 外部テスター初回審査前 |
| App Privacy（データ収集の申告） | **App のプライバシー** | 外部テスター初回審査前 |
| ベータ App の情報（説明・フィードバック先） | **TestFlight** → 「ベータ App の情報」 | 外部テスター提出時 |
| ベータ App レビュー情報 | **TestFlight** → 「テスト情報」 | 外部テスター提出時 |
| 輸出コンプライアンス | **TestFlight** → 対象ビルド → 「輸出コンプライアンス」 | ビルドごとに必須 |

##### 5.2.2. カテゴリ（プライマリ / セカンダリ）

1. 左サイドバー **App 情報** を開きます。
2. 「一般情報」セクションの **プライマリカテゴリ** / **セカンダリカテゴリ** プルダウンを設定します。
   - プライマリ推奨: `仕事効率化`（または `ライフスタイル`）
   - セカンダリ: 空欄でも可
3. ページ上部 **保存** を押します。

##### 5.2.3. プライバシーポリシー URL

1. **App 情報** → 「一般情報」の **プライバシーポリシー URL** 欄に URL を入力します。
2. TestFlight 外部テスター提出時点で有効な URL が必要なので、GitHub Pages やリポジトリ内 `docs/legal/privacy.md` をホスティングした URL を事前に準備します。
3. **保存** を押します。

##### 5.2.4. 年齢区分

1. **App 情報** → 「年齢区分」の **編集** を押します。
2. 質問票が表示されます。Hourglass は学習支援アプリなのでほぼ「なし」で回答します。代表的な設問:
   - 暴力描写、性的コンテンツ、薬物、アルコール、ギャンブル: すべて **なし**
   - アプリ内で無制限 Web アクセス: **なし**（外部ブラウザ表示は任意）
   - ユーザ生成コンテンツ: 現状 **なし**（将来コメント機能等が入ったら再確認）
3. 回答に応じて **4+** / **9+** / **12+** / **17+** が自動決定されます。想定は `4+` か `9+`。
4. **完了** → **保存**。

##### 5.2.5. App Privacy（データ収集の申告）

Firebase Auth で収集する情報を申告します。

1. 左サイドバー **App のプライバシー** を開きます。
2. 「データ収集」セクションで **開始** を押します。
3. 「このアプリはユーザからデータを収集しますか？」で **はい** を選択します。
4. 収集するデータ種別にチェックを入れます（Hourglass の現在の想定）。
   - **連絡先情報 → メールアドレス**（Firebase Auth で取得）
   - **識別子 → ユーザ ID**（Firebase UID）
   - 将来 Analytics を入れる場合は **使用状況データ → 製品とのインタラクション** を追加
5. 各データ項目について次を回答します。
   - **用途**: `アプリの機能` を選択（認証のため）
   - **ユーザへの紐付け**: **はい**（Firebase UID でユーザに紐付くため）
   - **トラッキング目的で使用するか**: **いいえ**（広告ネットワーク等への共有がないため）
6. 最後に **公開** を押します。

##### 5.2.6. ベータ App の情報（TestFlight 審査用）

1. 左サイドバー **TestFlight** → 「ベータ App の情報」を開きます。
2. 以下を入力します。
   - **ベータ App の説明**: 「集中学習のためのタイマーアプリ。Apple / Google アカウントでサインイン可能。」など 2〜3 行
   - **フィードバックメール**: オーナーの連絡メール
   - **マーケティング URL**: 任意（リポジトリ README の URL でも可）
3. **保存**。

##### 5.2.7. ベータ App レビュー情報

1. **TestFlight** → 「テスト情報」を開きます。
2. 次を入力します。
   - **連絡先情報**: 氏名・電話番号・メール（審査担当者からの連絡先）
   - **サインイン情報**: Sign in with Apple / Google で誰でもログインできる前提なので、**サインインが必要** のチェックは外して構いません。レビュー時にテストアカウントを渡したい場合は **はい** にして、専用のテストアカウントを用意します。
   - **注釈**: 「Apple / Google でサインイン後、タイマー機能が利用可能」のように審査者向けの補助情報を記入。
3. **保存**。

##### 5.2.8. 輸出コンプライアンス（ビルドごと）

1. ビルドアップロード後、**TestFlight** → 該当ビルドを開きます。
2. **暗号化の使用** について回答します。`app.json` / `app.config.ts` で `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` を設定済みなら、アップロード時に自動で「いいえ」扱いになり、この画面を開く必要はありません。
3. 上記の infoPlist が入っていないビルドでは、画面から **いいえ（該当する暗号化を使用していない）** を手動で選びます。
4. TLS 以外の暗号化を使用する場合は **はい** を選択し、輸出許可区分（通常は一般消費者向けの "ECCN 5D992" 等）を申告します。Hourglass では通常は **いいえ** で問題ありません。

#### 5.3. App Store Connect API Key の発行（将来の EAS Submit 用）

ここで取得までしておき、EAS Build / EAS Submit 導入時に再利用します。

1. **Users and Access → Integrations → App Store Connect API** を開きます。
2. **In-House** ではなく **Team Keys** タブで「生成」を選びます。
3. ロール: **Admin** または **App Manager**。
4. 発行後に `.p8` をダウンロード（1 度きり）し、Issuer ID と Key ID を控えます。

#### 5.4. 配布方式（Ad Hoc / TestFlight 内部 / 外部）の比較

iOS のアプリ配布手段は大きく 3 種類あります。本プロジェクトは Individual プラン + チーム運用のため **TestFlight 外部テスター** を主軸に据え、Ad Hoc は緊急時のバックアップとします。TestFlight 内部は Individual プランでは実質使えません。

##### 5.4.1. 早見表

| 項目 | Ad Hoc | TestFlight 内部 | TestFlight 外部 |
| --- | --- | --- | --- |
| 配布先 | UDID 登録済み実機 | App Store Connect の Users and Access メンバー | メールアドレス or 公開リンク |
| 最大人数 | 100 デバイス/年 | 100 名 | 10,000 名 |
| **Individual プランで実用か** | ○（UDID 登録で利用可） | **×（オーナー以外を追加できない）** | ○（メンバー配布の主手段） |
| Apple ベータ審査 | 不要 | 不要 | 初回必須（約 24 時間）、以降は変更幅に応じて要否 |
| ビルド有効期限 | 証明書が失効するまで（約 1 年） | 90 日 | 90 日 |
| 必要な証明書 | Apple Distribution | Apple Distribution | Apple Distribution |
| 必要な Provisioning Profile | Ad Hoc | App Store | App Store |
| UDID の事前登録 | 必要（4.6 参照） | 不要 | 不要 |
| 配布手段 | `.ipa` を直接渡す（Apple Configurator 2 / Firebase App Distribution / Diawi 等） | App Store Connect にアップロード → テスターに自動共有 | App Store Connect にアップロード → 招待メール or 公開リンクで配布 |
| メタデータ要件 | なし | なし | カテゴリ / プライバシーポリシー URL / 年齢区分 / App Privacy / ベータ App の情報 / レビュー用連絡先（5.2 参照） |
| フィードバック機能 | なし（Slack 等で手動収集） | TestFlight アプリ内「フィードバックを送信」 | 同左 |
| クラッシュ解析 | Xcode Organizer に手動で取得 | Xcode Organizer で自動集約 | 同左 |
| 実機で動作する Capability | すべて（Sign in with Apple / APNs など） | すべて | すべて |

##### 5.4.2. それぞれの準備物

**Ad Hoc**

- 配布対象の iPhone UDID（Apple Developer Portal → Devices に登録、4.6 参照）
- Apple Distribution 証明書
- Ad Hoc Provisioning Profile（該当 Bundle ID・Distribution 証明書・登録済み Devices を含む）
- `.ipa` の配布手段（推奨: Firebase App Distribution / 有線 USB 経由の Apple Configurator 2）

**TestFlight 内部**

- Apple Distribution 証明書 + App Store Provisioning Profile
- App Store Connect → Users and Access に登録された Apple ID。Individual プランでは **オーナー 1 名のみ** が対象（他メンバーを招待する口が無い）。
- Organization 切替後は最大 100 名の内部テスターを追加できます（10.1 参照）。

**TestFlight 外部**

- Apple Distribution 証明書 + App Store Provisioning Profile
- 5.2 のすべてのメタデータ入力（初回審査を通すため必須）
- テスターのメールアドレス（または公開リンクの発行）
- 初回ベータ App レビューの待ち時間（通常 24 時間、最大 48 時間見込んでおく）

##### 5.4.3. 本プロジェクトでの採用判断

| シナリオ | 採用する配布 | 理由 |
| --- | --- | --- |
| 日常のメンバー動作確認 | **TestFlight 外部** | Individual プランで唯一スケールする方式 |
| オーナー自身の検証 | ローカル実機ビルド | TestFlight / Ad Hoc を挟む手間が無駄 |
| 審査を待てない緊急検証（本番直前のバグ修正確認等） | **Ad Hoc** | UDID 登録済みメンバーに即座に配れる |
| 将来 Organization 化した場合 | TestFlight 内部 + 外部 | 内部 100 名枠で Apple 審査をスキップできるようになる |

##### 5.4.4. Ad Hoc 配布の具体手順（参考）

1. 配布したい環境で `npx expo prebuild -p ios --clean`（例: `APP_ENV=stg` で stg ビルド）。
2. Xcode で **Product → Archive** を実行。
3. Organizer → **Distribute App** → **Ad Hoc** → 署名は Automatic Signing → 対象デバイスを選択 → **Export** で `.ipa` を生成。
4. メンバーの iPhone へ配布する。
   - 有線: Apple Configurator 2（Mac App Store 無料）で iPhone を選択 → `.ipa` をドラッグ。
   - ワイヤレス: Firebase App Distribution / Diawi にアップロードしメンバーにリンクを送付。
5. メンバーは受領後、**設定 → 一般 → VPN とデバイス管理** でオーナーのアカウントを信頼してから起動。

Ad Hoc ビルドも TestFlight と同じく **オーナー ADP Team で署名された Apple Distribution ビルド** なので、Sign in with Apple はそのまま動作します（メンバーの個人 Team ビルドでは動かない点との違い）。

#### 5.5. TestFlight 外部テスターグループの作成

Individual プランでは「内部テスター」を自分以外追加できません。チームメンバーは外部テスターとして運用します。

1. アプリを選択 → **TestFlight** タブを開きます。
2. **外部テスト** → 「グループを追加」 → 名称 `Team` を作成します。
3. グループを開き、「テスターを追加」でメンバーのメールアドレスを登録します。
4. 初回ビルドには **ベータ App レビュー** が必要です。審査は通常 24 時間以内ですが、最初の提出時だけ余裕を見ておきます。
5. 審査を通ったビルドは、グループのテスター全員に招待メールが自動送信されます。

### 6. Firebase Console 設定

[Firebase Console](https://console.firebase.google.com/) で `hourglass-f10ca` プロジェクトを開き作業します。

#### 6.1. iOS アプリの追加

プロジェクト設定 → 「マイアプリ」 → iOS アプリの追加から次を登録します。共有アプリはオーナーが最初に登録し、個人アプリはメンバーが加わるたびにオーナーが追加します。

##### 6.1.1. 共有アプリ（3 件、初期セットアップ）

| アプリ名 | Bundle ID | ダウンロードするファイル名 |
| --- | --- | --- |
| Hourglass (dev) | `com.tutstudy.hourglass.dev` | `GoogleService-Info.dev.plist` |
| Hourglass (stg) | `com.tutstudy.hourglass.stg` | `GoogleService-Info.stg.plist` |
| Hourglass (prod) | `com.tutstudy.hourglass` | `GoogleService-Info.prod.plist` |

##### 6.1.2. 個人ローカルアプリ（メンバーごとに追加）

メンバーから識別子（例: `goda`）を受け取り、1 件ずつ登録します。

| アプリ名 | Bundle ID | ダウンロードするファイル名 |
| --- | --- | --- |
| Hourglass (goda local) | `com.tutstudy.hourglass.goda.local` | `GoogleService-Info.goda.local.plist` |

- オーナーが Firebase Console に登録し、`.plist` を該当メンバーに個別共有します（Slack の DM や 1Password Shared Vault など。リポジトリには commit しません）。
- 個人ファイルは `GoogleService-Info.{member}.local.plist` 命名で統一します。
- 登録時に控えておく値: 生成された iOS アプリの **REVERSED_CLIENT_ID**（メンバーが `app.config.ts` 経由で使う `GOOGLE_IOS_URL_SCHEME` の値）。`.plist` 内の `REVERSED_CLIENT_ID` キーから読み取り、メンバーに伝えます。

ダウンロードした `.plist` は各自 `mobile/` 直下に配置し、`.gitignore` 済みのまま扱います（コード側の切替は「7. リポジトリ側で別タスクとして行う変更」参照）。

#### 6.2. Apple プロバイダの有効化

Firebase プロジェクト全体に対して 1 回だけ設定します（6.1.1 の共有アプリに対しても 6.1.2 の個人アプリに対しても、プロジェクト単位で共通の設定になります）。個人アプリは Apple Sign In が動かないため、追加の Apple 登録作業は発生しません。

1. **Authentication** → **Sign-in method** タブを開きます。
2. **Apple** を選択し有効化します。
3. 次を入力します。
   - Services ID: 4.4 で作成した ID（例: `com.tutstudy.hourglass.signin`）
   - Apple Team ID: 4.1 で控えた値
   - Key ID: 4.5 で控えた値
   - Private Key: 4.5 でダウンロードした `.p8` の中身全体を貼り付け
4. 保存後、ログイン元ドメインとして `hourglass-f10ca.firebaseapp.com` が表示されていることを確認します。

#### 6.3. Google プロバイダの確認

既に有効化されています。Web クライアント ID は dev/stg/prod で **共用して問題ありません**（`mobile/app.json` L50 で参照している値）。Bundle ID 追加に伴い新たに取得する必要はありません。

#### 6.4. 承認済みドメインの確認

**Authentication** → **Settings** → **承認済みドメイン** に `hourglass-f10ca.firebaseapp.com` が含まれていることを確認します。含まれていない場合、Apple Services ID の Return URL と不整合が発生します。

### 7. リポジトリ側で別タスクとして行う変更

本ドキュメントのスコープ外として、次の実装作業を別タスクで行います。作業順序と影響範囲を把握しやすいよう予告として列挙します。

#### 7.1. `mobile/app.json.example` → `mobile/app.config.ts` への移行

`APP_ENV`（共有ビルドの環境切替）と `LOCAL_BUNDLE_SUFFIX`（個人ローカルビルドへの切替）の 2 変数で `ios.bundleIdentifier` / `ios.googleServicesFile` / `iosUrlScheme` を切り替える方針です。擬似コード:

```ts
// mobile/app.config.ts の骨子（別タスクで実装）
import type { ExpoConfig } from 'expo/config';

const ENV = (process.env.APP_ENV ?? 'dev') as 'dev' | 'stg' | 'prod';
const LOCAL_SUFFIX = process.env.LOCAL_BUNDLE_SUFFIX; // 例: 'goda'
const IS_LOCAL = Boolean(LOCAL_SUFFIX);

const sharedBundleIds = {
  dev: 'com.tutstudy.hourglass.dev',
  stg: 'com.tutstudy.hourglass.stg',
  prod: 'com.tutstudy.hourglass',
} as const;

const bundleId = IS_LOCAL
  ? `com.tutstudy.hourglass.${LOCAL_SUFFIX}.local`
  : sharedBundleIds[ENV];

const googleServicesFile = IS_LOCAL
  ? `./GoogleService-Info.${LOCAL_SUFFIX}.local.plist`
  : `./GoogleService-Info.${ENV}.plist`;

const appName = IS_LOCAL
  ? `Hourglass (${LOCAL_SUFFIX})`
  : ENV === 'prod'
    ? 'Hourglass'
    : `Hourglass (${ENV})`;

export default (): ExpoConfig => ({
  name: appName,
  slug: 'hourglass',
  ios: {
    bundleIdentifier: bundleId,
    googleServicesFile,
    usesAppleSignIn: true,
    supportsTablet: false,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  plugins: [
    // ...既存 plugins を踏襲
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME },
    ],
  ],
  // ...既存の extra を踏襲
});
```

`LOCAL_BUNDLE_SUFFIX` が未設定ならオーナー向け共有ビルド、設定されていればメンバーの個人ローカルビルドに切り替わります。

#### 7.2. `mobile/eas.json` の build profile 整備

```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "env": { "APP_ENV": "dev" } },
    "preview":     { "distribution": "internal", "env": { "APP_ENV": "stg" } },
    "production":  { "env": { "APP_ENV": "prod" } }
  }
}
```

#### 7.3. GoogleService-Info の環境別分割

現行: `mobile/GoogleService-Info.plist` の 1 ファイル運用。
移行後: `mobile/GoogleService-Info.dev.plist` / `.stg.plist` / `.prod.plist` の 3 ファイルを `.gitignore` のまま配置。

#### 7.4. `mobile/.env.example` の新設

```bash
# ===== 共通 =====
API_BASE_URL=http://192.168.x.x:8080/api/v1
GOOGLE_WEB_CLIENT_ID=266315636738-xxx.apps.googleusercontent.com

# ===== オーナー（共有ビルド）=====
# APP_ENV=dev
# GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.266315636738-xxx  # 共有 dev 用 REVERSED_CLIENT_ID

# ===== メンバー（個人ローカルビルド）=====
# LOCAL_BUNDLE_SUFFIX を設定すると APP_ENV より優先される
# LOCAL_BUNDLE_SUFFIX=goda
# GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.xxxxxxxxx           # 個人用 REVERSED_CLIENT_ID
```

`app.config.ts` 側では `process.env.APP_ENV` / `process.env.LOCAL_BUNDLE_SUFFIX` / `process.env.GOOGLE_IOS_URL_SCHEME` / `process.env.API_BASE_URL` を参照します。

#### 7.5. `mobile/setup.md` の修正

`mobile/setup.md` L68-96 の「Apple サインインを有効にするには」節を削除し、本ドキュメント（`docs/operations/apple-developer.md`）への参照リンクに差し替えます。`1-3. bundleIdentifier の編集` 節も「`APP_ENV` で自動切替されるため手動編集不要」と書き換えます。

#### 7.6. prebuild コマンドの指針

チェックアウト後は次のコマンドで ios/ を再生成します。

```bash
cd mobile
APP_ENV=dev npx expo prebuild -p ios
```

### 8. 開発〜TestFlight 配布フロー

#### 8.1. オーナーの作業

1. `APP_ENV=dev` でローカル実機ビルドし、機能開発と Sign in with Apple の検証を行います。
2. リリース候補ができたら次を実行します。
   ```bash
   cd mobile
   APP_ENV=prod npx expo prebuild -p ios --clean
   ```
3. Xcode で `mobile/ios/Hourglass.xcworkspace` を開き、**Product → Archive** を実行します。
4. **Distribute App → App Store Connect → Upload** を選び、App Store Connect にビルドをアップロードします。
5. App Store Connect の TestFlight タブで該当ビルドを選び、**外部グループ "Team"** に配信します。初回はベータ App レビューに提出します。
6. 審査通過後、メンバーに招待メールが届きます。

#### 8.2. メンバーの作業

1. App Store から **TestFlight** アプリをインストールします。
2. オーナーから届く招待メールを、Apple ID と同じメールアカウントで開きます。
3. 「View in TestFlight」をタップして Hourglass を追加します。
4. 以降、新しいビルドが配信されるたびに TestFlight アプリから更新できます。
5. 不具合は Issue / PR としてリポジトリに起票します。

#### 8.3. メンバーがローカルでソースビルドする場合

個人 Apple ID + 個人ローカル Bundle ID で署名します。以下の手順で準備します。

##### 8.3.1. 初回セットアップ

1. メンバーが自分の識別子（例: `goda`）を決めてオーナーに伝える。
2. オーナーが Firebase Console に個人 iOS アプリ `com.tutstudy.hourglass.{member}.local` を追加し（6.1.2）、次の 2 点をメンバーに渡す。
   - `GoogleService-Info.{member}.local.plist`
   - その `.plist` 内の `REVERSED_CLIENT_ID`（`GOOGLE_IOS_URL_SCHEME` に設定する値）
3. メンバーは受領した `.plist` を `mobile/` 直下に配置し、`mobile/.env` を次のように設定する。
   ```bash
   LOCAL_BUNDLE_SUFFIX=goda
   GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.xxxxxxxxx
   GOOGLE_WEB_CLIENT_ID=266315636738-xxx.apps.googleusercontent.com
   API_BASE_URL=http://192.168.x.x:8080/api/v1
   ```
4. 次を実行する。
   ```bash
   cd mobile
   npx expo prebuild -p ios --clean
   ```
5. Xcode で `mobile/ios/Hourglass.xcworkspace` を開き、**Signing & Capabilities** の Team を自分の個人 Apple ID Team に変更する（Automatic Signing を推奨）。Bundle Identifier は `com.tutstudy.hourglass.{member}.local` に自動反映される。
6. 実機で Run。

##### 8.3.2. 動作確認時の制約

- **Google Sign In**: 通常通り動作します。
- **Apple Sign In**: 個人 Team では `Sign in with Apple` Capability が付与できないため動作しません。UI 側で `AppleAuthentication.isAvailableAsync()` により非表示にする想定（未実装なら別タスクで対応）。エンドツーエンド検証はオーナー配布の TestFlight ビルドで行います。
- **Provisioning Profile の失効**: 7 日ごとに Xcode から Run し直すことで自動再発行されます。

### 9. 日常運用

#### 9.1. ADP の年次更新

- 更新費用: $99/年。
- 更新期限切れから 30 日以内に更新しないと、証明書・Provisioning Profile が全て失効し、App Store の配信も停止します。更新時期はカレンダー等にリマインダーを設定します。

#### 9.2. 証明書・Provisioning Profile の期限

| 項目 | 有効期限 |
| --- | --- |
| Apple Development Certificate | 1 年 |
| Apple Distribution Certificate | 1 年 |
| Provisioning Profile（Automatic Signing） | 自動再生成 |
| Provisioning Profile（手動管理） | 1 年（Development）/ 1 年（Distribution） |

Xcode Automatic Signing を使っていれば証明書失効時に「Revoke and Request」で自動復旧可能です。

#### 9.3. TestFlight ビルドの有効期限

- ビルドごとに **90 日** で期限切れになります。
- 期限間近になるとメンバーに通知されます。新しいビルドを提出することで更新します。

#### 9.4. メンバーの入退

- **追加**: App Store Connect の TestFlight 外部テスターグループにメールアドレスを追加します。ADP Team への招待は不要（Individual では不可）です。
- **削除**: 同じ画面からメールアドレスを削除します。

### 10. 将来的な拡張

#### 10.1. Organization プランへの切替

D-U-N-S 番号を取得することで、個人アカウントから法人アカウント相当の Organization プランへ切替えられます。切替後は次が可能になります。

- 他メンバーを Admin / App Manager / Developer として ADP Team に招待
- 内部テスターへの追加（最大 100 名）
- 各メンバーが自分の Apple ID でローカル実機ビルド時に正式な Team ID で署名

切替申請は Apple 本社の審査を伴うため 2〜4 週間かかる場合があります。

#### 10.2. EAS Build / EAS Submit への移行

- `eas.json` の production profile を整備し、EAS 上で iOS クラウドビルドを回します。
- EAS の **credentials** 管理に下記を登録します。
  - Apple Distribution Certificate（`.p12` ＋パスフレーズ）
  - Provisioning Profile（EAS が自動管理する方式を推奨）
  - App Store Connect API Key（`.p8` + Issuer ID + Key ID）
- `eas submit -p ios --profile production` で TestFlight 提出までコマンドラインで完結します。

#### 10.3. FCM Push Notifications

- Apple Developer Portal の Keys で **APNs Authentication Key (.p8)** を発行します（Sign in with Apple Key とは別 Key）。
- Firebase Console → プロジェクト設定 → Cloud Messaging → **Apple app configuration** に APNs Key、Key ID、Team ID を登録します。
- App ID の Capability で **Push Notifications** が有効になっていること（4.3 で設定済み）を再確認します。

### 11. トラブルシューティング

#### 11.1. Xcode で "No account for team 34fhne349g" と表示される

オーナー以外の Mac で開いた場合に発生します。原因は Xcode の Apple ID 設定に ADP 加入者のアカウントが入っていないことです。対処:

- メンバー自身で開発する場合は、Signing & Capabilities の Team をメンバー自身の個人 Team に変更し、Bundle ID も個人用に差し替えます（「3.3 メンバーの動線」参照）。
- オーナーが他 Mac で開く場合は Xcode → **Settings → Accounts** でオーナー Apple ID を追加します。

#### 11.2. Sign in with Apple が `AuthorizationError: 1000` で失敗する

主な原因:

1. App ID に `Sign in with Apple` Capability が未付与 → 4.3 を再確認します。
2. `mobile/ios/Hourglass/Hourglass.entitlements` に `com.apple.developer.applesignin` キーが無い → `npx expo prebuild -p ios --clean` で再生成します。
3. 個人 Team ID で署名している → メンバーが個人 Team でビルドしていないか確認します。

#### 11.3. TestFlight にビルドが表示されない

- App Store Connect の **TestFlight** タブで該当ビルドが `Processing` 状態のままの場合、10〜30 分待ちます。
- `Missing Compliance` になっている場合、ビルドを選び **輸出コンプライアンス情報** を回答します（`ITSAppUsesNonExemptEncryption: false` が `infoPlist` に入っていれば自動化されるはずですが、念のため画面で確認）。
- 初回は **ベータ App レビュー** の通過が必要です。却下された場合はメールに理由が記載されます。

#### 11.4. Firebase で `auth/invalid-credential` が発生する

- Services ID と App ID を取り違えていないか確認します（Firebase に設定するのは **Services ID** のほう）。
- Return URL が `https://hourglass-f10ca.firebaseapp.com/__/auth/handler` と完全一致しているか確認します（末尾スラッシュの有無も含めて）。
- Key (.p8) の貼り付け時に改行が消えていないか確認します。全文（`-----BEGIN PRIVATE KEY-----` から `-----END PRIVATE KEY-----` まで）を貼り付けます。

#### 11.5. メンバーのローカルビルドで `bundle identifier ... is not available` と出る

オーナーが登録した共有 Bundle ID（`com.tutstudy.hourglass.dev` など）で署名しようとしたことが原因です。共有 Bundle ID はオーナー ADP Team に占有されているため、メンバーの個人 Team では使えません（3.5.1 参照）。対処:

1. `mobile/.env` に `LOCAL_BUNDLE_SUFFIX=<自分の識別子>` が設定されているか確認します。未設定だと共有 Bundle ID が選ばれます。
2. 自分用の `GoogleService-Info.{member}.local.plist` と `GOOGLE_IOS_URL_SCHEME` をオーナーから受領しているか確認します。
3. `npx expo prebuild -p ios --clean` で `ios/` を再生成してから Xcode で Run します。

### 12. チェックリスト

#### 12.1. オーナー初期セットアップ

- [ ] Team ID を控えた
- [ ] Apple Development / Apple Distribution 証明書を発行した
- [ ] App ID を 3 本（dev/stg/prod）作成し Sign in with Apple と Push Notifications を有効化した
- [ ] Services ID を作成し Primary App ID と Return URL を登録した
- [ ] Sign in with Apple 用 Key (.p8) をダウンロードし安全に保管した
- [ ] Firebase に iOS アプリを 3 件登録し `GoogleService-Info.*.plist` を取得した
- [ ] Firebase Authentication の Apple プロバイダに Services ID / Team ID / Key ID / .p8 を登録した
- [ ] App Store Connect に prod アプリを登録した
- [ ] App Store Connect API Key を発行・保管した
- [ ] TestFlight 外部テスターグループ `Team` を作成した

#### 12.2. メンバー受け入れ

- [ ] メンバーから識別子（`{member}`）を受領した
- [ ] Firebase Console に個人 iOS アプリ `com.tutstudy.hourglass.{member}.local` を追加した
- [ ] メンバーに `GoogleService-Info.{member}.local.plist` と `GOOGLE_IOS_URL_SCHEME` の値を共有した
- [ ] メンバーが自分の個人 Team でローカルビルドし Google Sign In で起動確認できた
- [ ] メンバーのメールアドレスを外部テスターグループに追加した
- [ ] メンバーが TestFlight アプリで Hourglass をインストールできた
- [ ] メンバーが TestFlight ビルドで Sign in with Apple / Google Sign In の両方でログインできた

#### 12.3. リリース時（各ビルド）

- [ ] `APP_ENV=prod` で prebuild した
- [ ] Xcode Archive でビルドを作成した
- [ ] App Store Connect にアップロードした
- [ ] 輸出コンプライアンスに回答した
- [ ] 外部テスターグループ向けにベータ版を提出した
- [ ] 初回の場合、ベータ App レビューの通過を確認した

#### 12.4. 年次更新

- [ ] ADP を $99 で更新した
- [ ] 新しい証明書・Provisioning Profile を生成した
- [ ] Key (.p8) を再発行した場合、Firebase の Apple プロバイダ設定を更新した
- [ ] チームメンバーに更新完了をアナウンスした

# 動作確認するまでのセットアップ

## 1. ios ディレクトリを作成する

```
cd /Users/yuhei/Desktop/Develop/hourglass/mobile
npx expo prebuild -p ios       # ios/ ディレクトリ生成
open ios/Hourglass.xcworkspace  # Xcode で開く
```

`prebuild` 後は `ios/` が生成物として扱われるため、必要に応じて `.gitignore` の対象になっているかを確認する。

## 2. CocoaPods の依存をインストールする

`prebuild` の末尾で自動実行されるが、失敗した場合や手動でやり直したい場合は以下を実行する。

```
cd ios
pod install
cd ..
```

- Apple Silicon (M1/M2/M3) で `pod install` が失敗する場合は `arch -x86_64 pod install` を試す
- CocoaPods が未インストールなら `brew install cocoapods` で導入する

## 3. 署名設定を行う

Xcode で `Hourglass.xcworkspace` を開き、`Signing & Capabilities` から以下を設定する。

- Team: 個人または組織の Apple Developer アカウントを選択
- Bundle Identifier: `app.json` の `ios.bundleIdentifier` と一致させる

実機で動作確認する場合はデバイスを信頼済みにし、初回起動時に iOS 側で開発元を信頼する。

## 4. 開発サーバを起動する

リポジトリのルートから Taskfile 経由で Metro を起動する。

```
cd /Users/yuhei/Desktop/Develop/hourglass
task mobile:start
```

初回やキャッシュ起因の不具合が出た場合はキャッシュをクリアして起動する。

```
cd mobile
npx expo start -c
```

## 5. iOS シミュレータで起動する

Metro 起動中のターミナルで `i` を押すか、別ターミナルから次を実行する。

```
task mobile:ios
```

Android エミュレータで動作確認する場合は `task mobile:android` を使う。

## 6. 動作確認チェックリスト

- ルート (`/`) のタブが表示されるか
- サインイン画面 (`/(auth)/sign-in`) に遷移できるか
- セッション配下の `input` / `break` / `output` / `result` が表示されるか
- Metro のログに `ReferenceError: Property 'document' doesn't exist` が出ていないか

## トラブルシューティング

### `ReferenceError: Property 'document' doesn't exist` が出る

`metro.config.js` で `resolver.unstable_enablePackageExports = true` を設定していると、Tamagui などが Web 向けエントリに解決され、React Native 実行時に `document` 参照で落ちる。設定を外し、キャッシュをクリアして再起動する。

```
npx expo start -c
```

### Route が `missing the required default export` と警告される

上記の `document` エラーが発生していると、各ルートの default export も巻き添えで読み込めなくなり、この警告が大量に出る。原因のエラーを先に解消すれば警告も消える。

### `pod install` でビルドエラーになる

以下の順に試す。

```
cd ios
rm -rf Pods Podfile.lock
pod repo update
pod install
```

それでも解消しない場合は `npx expo prebuild -p ios --clean` で `ios/` を再生成する（ローカルの変更は失われるため注意）。

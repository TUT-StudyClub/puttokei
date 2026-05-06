/* eslint-env node */

/**
 * Expo の動的設定。
 *
 * 値の解決順 (優先度高い順):
 *   1. `process.env.EXPO_PUBLIC_*`              ... .env.local / EAS env で個別に上書き
 *   2. ローカル `app.json` (gitignored / 任意)  ... 個人ごとの overlay
 *   3. `app.json.example` (git tracked)         ... チーム共通のデフォルト
 *
 * 想定する切替軸:
 * - `EXPO_PUBLIC_API_BASE_URL`        ... backend の API base URL
 * - `EXPO_PUBLIC_BUNDLE_IDENTIFIER`   ... iOS bundleIdentifier / Android package
 * - `EXPO_PUBLIC_GOOGLE_SERVICES_IOS` ... iOS の googleServicesFile (= GoogleService-Info.plist)
 *
 * 環境構成:
 * - dev (ローカル開発)        : com.hourglass.dev  + GoogleService-Info.dev.plist  + LAN backend
 * - stg (TestFlight 内部配布) : com.hourglass.stg  + GoogleService-Info.stg.plist  + Cloud Run
 * - prod (App Store 公開)     : com.hourglass.prod + GoogleService-Info.prod.plist + Cloud Run
 */
const fs = require('fs');
const path = require('path');

// `app.json.example` は拡張子が `.example` のため node の `require` では JSON として
// 読めない (= JS と解釈されて SyntaxError)。readFileSync + JSON.parse で読み込む。
const exampleConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'app.json.example'), 'utf8'),
);

function loadLocalOverride() {
  try {
    return require('./app.json');
  } catch (_err) {
    return null;
  }
}

// `app.json.example` に残った `YOUR_*` プレースホルダが差し替えられないまま build が
// 走るのを防ぐ。`app.json` (overlay) または env で実値が供給されているか検証する。
function assertPlaceholdersResolved(value, fieldName) {
  if (typeof value === 'string' && value.startsWith('YOUR_')) {
    throw new Error(
      `[app.config.js] '${fieldName}' is still a placeholder ('${value}'). ` +
        'Set it via mobile/app.json (gitignored) or the corresponding EXPO_PUBLIC_* env.',
    );
  }
}

module.exports = ({ config }) => {
  const localOverride = loadLocalOverride();
  const base = (localOverride && localOverride.expo) || exampleConfig.expo;

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ?? (base.extra && base.extra.apiBaseUrl);
  const bundleIdentifier =
    process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER ?? (base.ios && base.ios.bundleIdentifier);
  const androidPackage =
    process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER ?? (base.android && base.android.package);
  const googleServicesFile =
    process.env.EXPO_PUBLIC_GOOGLE_SERVICES_IOS ?? (base.ios && base.ios.googleServicesFile);

  // build / submit に必要な識別子はテンプレ未差し替え状態で漏れるのを防ぐ。
  assertPlaceholdersResolved(base.ios && base.ios.appleTeamId, 'ios.appleTeamId');
  assertPlaceholdersResolved(base.owner, 'owner');
  assertPlaceholdersResolved(base.extra && base.extra.eas && base.extra.eas.projectId, 'extra.eas.projectId');
  assertPlaceholdersResolved(base.extra && base.extra.googleWebClientId, 'extra.googleWebClientId');

  return {
    ...base,
    // ConfigContext.config の name / slug は package.json の name (= hourglass-mobile)
    // からフォールバックされることがあるため、本ファイルでは app.json.example の値を
    // 最優先する。
    name: base.name || (config && config.name) || 'Hourglass',
    slug: base.slug || (config && config.slug) || 'hourglass',
    ios: {
      ...base.ios,
      bundleIdentifier,
      googleServicesFile,
    },
    android: {
      ...base.android,
      package: androidPackage,
    },
    extra: {
      ...(base.extra || {}),
      apiBaseUrl,
    },
  };
};

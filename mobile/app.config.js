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
 * - `EXPO_PUBLIC_APPLE_TEAM_ID`       ... iOS appleTeamId
 * - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` ... Google Sign-In の Web client ID
 * - `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` ... Google Sign-In の iOS URL scheme
 * - `EXPO_PUBLIC_EAS_PROJECT_ID`      ... EAS project ID
 * - `EXPO_PUBLIC_EAS_OWNER`           ... Expo account owner
 *
 * 環境構成:
 * - dev (ローカル開発)        : com.hourglass.dev  + GoogleService-Info.dev.plist  + LAN backend
 * - stg (TestFlight 内部配布) : com.hourglass.stg  + GoogleService-Info.stg.plist  + Cloud Run
 * - prod (App Store 公開)     : com.hourglass.prod + GoogleService-Info.prod.plist + Cloud Run
 */
const fs = require('fs');
const path = require('path');

const GOOGLE_SIGN_IN_PLUGIN = '@react-native-google-signin/google-signin';

// `app.json.example` は拡張子が `.example` のため node の `require` では JSON として
// 読めない (= JS と解釈されて SyntaxError)。readFileSync + JSON.parse で読み込む。
const exampleConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json.example'), 'utf8'));

function loadLocalOverride() {
  try {
    return require('./app.json');
  } catch (err) {
    // `app.json` が存在しない場合は overlay 無しとして扱う。それ以外 (JSON 構文
    // エラー等) は静かに握りつぶさず原因が分かるよう例外を再送出する。
    if (err && err.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw err;
  }
}

// `app.json.example` に残った `YOUR_*` プレースホルダが差し替えられないまま build が
// 走るのを防ぐ。`app.json` (overlay) または env で実値が供給されているか検証する。
function isPlaceholder(value) {
  return typeof value === 'string' && value.startsWith('YOUR_');
}

function shouldAssertPlaceholders() {
  return process.env.EAS_BUILD === 'true' || process.env.EAS_BUILD_RUNNER === 'eas-build';
}

function readEnv(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  return value;
}

// config tree 全体を再帰的に走査し、最初に見つかった `YOUR_*` プレースホルダを
// パス付きで返す。個別フィールドを assert する書き方より、新規プレースホルダを
// 追加した場合の検証漏れを防ぎやすい。
function findUnresolvedPlaceholder(value, segments = []) {
  if (isPlaceholder(value)) {
    return { path: segments.join('.') || '<root>', value };
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findUnresolvedPlaceholder(value[i], [...segments, String(i)]);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const found = findUnresolvedPlaceholder(child, [...segments, key]);
      if (found) return found;
    }
  }
  return null;
}

function extractGoogleIosUrlScheme(plugins) {
  const plugin = plugins.find(
    (candidate) => Array.isArray(candidate) && candidate[0] === GOOGLE_SIGN_IN_PLUGIN,
  );
  return plugin && plugin[1] && plugin[1].iosUrlScheme;
}

function resolvePlugins(plugins, googleIosUrlScheme) {
  return plugins.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== GOOGLE_SIGN_IN_PLUGIN) {
      return plugin;
    }

    const options = plugin[1] || {};
    const resolvedIosUrlScheme = googleIosUrlScheme || options.iosUrlScheme;
    // ローカル開発で `iosUrlScheme` がプレースホルダのままの場合、plugin の引数を
    // 落として Google Sign In を no-op に縮退させる。EAS Build 時は
    // findMissingBuildValue で early fail する。
    if (!resolvedIosUrlScheme || isPlaceholder(resolvedIosUrlScheme)) {
      return plugin[0];
    }

    return [plugin[0], { ...options, iosUrlScheme: resolvedIosUrlScheme }];
  });
}

function findMissingBuildValue(requiredValues) {
  return requiredValues.find((entry) => !entry.value || isPlaceholder(entry.value));
}

module.exports = ({ config }) => {
  const localOverride = loadLocalOverride();
  const base = (localOverride && localOverride.expo) || exampleConfig.expo;
  const plugins = base.plugins || [];

  const apiBaseUrl =
    readEnv(process.env.EXPO_PUBLIC_API_BASE_URL) ?? (base.extra && base.extra.apiBaseUrl);
  const bundleIdentifier =
    readEnv(process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER) ?? (base.ios && base.ios.bundleIdentifier);
  const androidPackage =
    readEnv(process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER) ?? (base.android && base.android.package);
  const googleServicesFile =
    readEnv(process.env.EXPO_PUBLIC_GOOGLE_SERVICES_IOS) ??
    (base.ios && base.ios.googleServicesFile);
  const appleTeamId =
    readEnv(process.env.EXPO_PUBLIC_APPLE_TEAM_ID) ?? (base.ios && base.ios.appleTeamId);
  const googleWebClientId =
    readEnv(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ??
    (base.extra && base.extra.googleWebClientId);
  const googleIosUrlScheme =
    readEnv(process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) ?? extractGoogleIosUrlScheme(plugins);
  const easProjectId =
    readEnv(process.env.EXPO_PUBLIC_EAS_PROJECT_ID) ??
    (base.extra && base.extra.eas && base.extra.eas.projectId);
  const easOwner = readEnv(process.env.EXPO_PUBLIC_EAS_OWNER) ?? base.owner;

  const finalConfig = {
    // expo-doctor の ExpoConfigCommonIssueCheck は引数 `config` (= 静的 app.json) を
    // dynamic config に取り込んだかを Symbol で検出する。本ファイルは app.json を
    // require で直接読み直しているため、Symbol を伝播させる目的で先頭に展開する。
    // 後続の base 展開で値は上書きされるので、解決順序の意味は変わらない。
    ...(config || {}),
    ...base,
    // ConfigContext.config の name / slug は package.json の name (= hourglass-mobile)
    // からフォールバックされることがあるため、本ファイルでは app.json.example の値を
    // 最優先する。
    name: base.name || (config && config.name) || 'Hourglass',
    slug: base.slug || (config && config.slug) || 'hourglass',
    owner: easOwner,
    plugins: resolvePlugins(plugins, googleIosUrlScheme),
    ios: {
      ...base.ios,
      bundleIdentifier,
      googleServicesFile,
      appleTeamId,
    },
    android: {
      ...base.android,
      package: androidPackage,
    },
    extra: {
      ...(base.extra || {}),
      apiBaseUrl,
      googleWebClientId,
      eas: {
        ...((base.extra && base.extra.eas) || {}),
        projectId: easProjectId,
      },
    },
  };

  if (shouldAssertPlaceholders()) {
    // build / submit に必要な識別子はテンプレ未差し替え状態で漏れるのを防ぐ。
    const missingBuildValue = findMissingBuildValue([
      { path: 'ios.appleTeamId', value: appleTeamId },
      { path: 'owner', value: easOwner },
      { path: 'extra.eas.projectId', value: easProjectId },
      { path: 'extra.googleWebClientId', value: googleWebClientId },
      {
        path: `plugins.${GOOGLE_SIGN_IN_PLUGIN}.iosUrlScheme`,
        value: googleIosUrlScheme,
      },
    ]);
    if (missingBuildValue) {
      throw new Error(
        `[app.config.js] '${missingBuildValue.path}' is not set or still a placeholder. ` +
          'Set it via mobile/app.json (gitignored) or the corresponding EXPO_PUBLIC_* env.',
      );
    }

    // 個別 assert より config tree 全体を再帰走査することで新規プレースホルダ追加時の
    // 検証漏れを防ぐ。
    const unresolved = findUnresolvedPlaceholder(finalConfig);
    if (unresolved) {
      throw new Error(
        `[app.config.js] '${unresolved.path}' is still a placeholder ('${unresolved.value}'). ` +
          'Set it via mobile/app.json (gitignored) or the corresponding EXPO_PUBLIC_* env.',
      );
    }
  }

  return finalConfig;
};

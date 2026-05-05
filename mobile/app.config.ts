/**
 * Expo の動的設定。`app.json` をベースに、EAS build profile / ローカル開発 (`.env` /
 * `EXPO_PUBLIC_*`) から環境ごとの値を上書きする。
 *
 * 想定する切替軸:
 * - `EXPO_PUBLIC_API_BASE_URL`        ... backend の API base URL
 * - `EXPO_PUBLIC_BUNDLE_IDENTIFIER`   ... iOS bundleIdentifier / Android package
 * - `EXPO_PUBLIC_GOOGLE_SERVICES_IOS` ... iOS の googleServicesFile (= GoogleService-Info.plist)
 *
 * これらが未設定の場合は `app.json` の値（= ローカル開発のデフォルト = dev 環境）を
 * そのまま使う。
 *
 * 環境構成:
 * - dev (ローカル開発)        : com.hourglass.dev  + GoogleService-Info.dev.plist  + LAN backend
 * - stg (TestFlight 内部配布) : com.hourglass.stg  + GoogleService-Info.stg.plist  + Cloud Run
 * - prod (App Store 公開)     : com.hourglass.prod + GoogleService-Info.prod.plist + Cloud Run
 */
import type { ExpoConfig, ConfigContext } from 'expo/config';

import baseConfig from './app.json';

type ExtraConfig = {
  router?: { origin?: boolean };
  eas?: { projectId?: string };
  apiBaseUrl?: string;
  googleWebClientId?: string;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = (baseConfig as { expo: ExpoConfig }).expo;

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? (base.extra as ExtraConfig)?.apiBaseUrl;
  const bundleIdentifier =
    process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER ?? base.ios?.bundleIdentifier;
  const androidPackage = process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER ?? base.android?.package;
  const googleServicesFile =
    process.env.EXPO_PUBLIC_GOOGLE_SERVICES_IOS ?? base.ios?.googleServicesFile;

  return {
    ...base,
    name: config.name ?? base.name ?? 'Hourglass',
    slug: config.slug ?? base.slug ?? 'hourglass',
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
      ...(base.extra as ExtraConfig),
      apiBaseUrl,
    },
  };
};

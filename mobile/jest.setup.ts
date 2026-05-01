/**
 * Jest のグローバル setup。
 * React Native / Expo 系のモックや、テスト用の polyfill が必要になればここに追加する。
 */

// react-native-reanimated はテスト環境では UI thread / worklet が動かないため、
// 公式の jest mock に差し替えて API を no-op に縮退させる。
// （SvgXml の中で Reanimated のフックを使っても、テストではただの値で評価される）
require('react-native-reanimated/mock');

// @react-native-firebase/messaging はモジュール読み込みだけでネイティブモジュール
// (RNFBNativeEventEmitter) を初期化しに行く。jest 上ではネイティブが無いため、
// 関数オブジェクトとしての thin stub に差し替え、import を通す。
jest.mock('@react-native-firebase/messaging', () => {
  const messaging = jest.fn(() => ({
    getToken: jest.fn().mockResolvedValue(null),
    registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
    onTokenRefresh: jest.fn(() => () => undefined),
  }));
  return { __esModule: true, default: messaging };
});

// expo-notifications は scheduleNotificationAsync などを呼ばないテストでも
// import 時に native module を要求するため、stub に差し替える。
jest.mock('expo-notifications', () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  useLastNotificationResponse: jest.fn(() => null),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

jest.mock('expo-device', () => ({
  __esModule: true,
  isDevice: false,
}));

export {};

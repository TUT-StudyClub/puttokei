/**
 * Jest のグローバル setup。
 * React Native / Expo 系のモックや、テスト用の polyfill が必要になればここに追加する。
 */

// react-native-reanimated はテスト環境では UI thread / worklet が動かないため、
// 公式の jest mock に差し替えて API を no-op に縮退させる。
// （SvgXml の中で Reanimated のフックを使っても、テストではただの値で評価される）
require('react-native-reanimated/mock');

// expo-image-manipulator は内部で native module を要求するため、
// jest 環境ではダミーに差し替えて読み込みエラーを避ける。
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async (uri: string) => ({ uri, width: 1600, height: 1200 })),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

export {};

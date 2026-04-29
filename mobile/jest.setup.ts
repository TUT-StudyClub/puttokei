/**
 * Jest のグローバル setup。
 * React Native / Expo 系のモックや、テスト用の polyfill が必要になればここに追加する。
 */

// react-native-reanimated はテスト環境では UI thread / worklet が動かないため、
// 公式の jest mock に差し替えて API を no-op に縮退させる。
// （SvgXml の中で Reanimated のフックを使っても、テストではただの値で評価される）
require('react-native-reanimated/mock');

export {};

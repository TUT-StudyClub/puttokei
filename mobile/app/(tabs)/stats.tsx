/**
 * レポートタブのルート。
 *
 * ローカル動作確認では sign-in 画面の見た目確認を優先して `/(auth)/sign-in` へ送る。
 * それ以外のビルドでは通常どおり StatsScreen を描画する。
 */
import { Redirect } from 'expo-router';

import { StatsScreen } from '@/features/stats/screens/StatsScreen';

export default function StatsTab() {
  if (__DEV__) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <StatsScreen />;
}

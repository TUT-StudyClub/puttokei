/**
 * Expo ネイティブ splash の表示制御。
 *
 * 起動直後は `preventAutoHideAsync()` で native splash を保持し、
 * React 側のブート画面が描画できる段階で `hideSplashWhenReady()` から閉じる。
 */
import * as SplashScreen from 'expo-splash-screen';

let hideRequested = false;

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * React 側の初期画面が表示可能になったら native splash を閉じる。
 * 2 回以降の呼び出しは no-op。
 */
export function hideSplashWhenReady(): void {
  if (hideRequested) return;
  hideRequested = true;

  SplashScreen.hideAsync().catch(() => {});
}

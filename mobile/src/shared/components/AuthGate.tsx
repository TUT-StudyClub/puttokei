/**
 * ルーティングガード。以下の優先順位で遷移を制御する。
 *
 * 1. チュートリアル未完了 → `/(auth)/overview` (uid の有無に関わらず最優先)
 * 2. チュートリアル完了 & 未認証 → `(tabs)` / `(auth)` 配下の滞在を許可、それ以外は overview へ
 * 3. チュートリアル完了 & 認証済 → `(auth)` から `(tabs)` へ
 *
 * チュートリアル完了フラグはメモリ内 (Zustand) に保持するため、
 * アプリを再起動するたびにチュートリアルが再表示される。
 */
import { type Href, useRouter, useSegments } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';

import { BOOT_SCREEN_MIN_DURATION_MS, BootScreen } from '@/shared/components/BootScreen';
import { hideSplashWhenReady } from '@/shared/lib/splash';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

const AUTH_SEGMENT = '(auth)';
const TABS_SEGMENT = '(tabs)';
const AUTH_OVERVIEW_ROUTE = '/(auth)/overview' as unknown as Href;
const TABS_ROUTE = '/(tabs)' as unknown as Href;

export function AuthGate({ children }: { children: ReactNode }) {
  const uid = useAuthStore((s) => s.uid);
  const tutorialCompleted = useTutorialStore((s) => s.completed);
  const router = useRouter();
  const segments = useSegments();
  const [bootMinimumElapsed, setBootMinimumElapsed] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setBootMinimumElapsed(true);
    }, BOOT_SCREEN_MIN_DURATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const topSegment = segments[0];

    // 1. チュートリアル未完了は uid に関わらず (auth) 配下に固定する。
    if (!tutorialCompleted) {
      if (topSegment !== AUTH_SEGMENT) {
        router.replace(AUTH_OVERVIEW_ROUTE);
      }
      return;
    }

    // 2. 未認証 & チュートリアル完了 → (tabs) or (auth)/sign-in を許可。
    if (uid === null) {
      if (topSegment !== AUTH_SEGMENT && topSegment !== TABS_SEGMENT) {
        router.replace(AUTH_OVERVIEW_ROUTE);
      }
      return;
    }

    // 3. 認証済 & チュートリアル完了 → (auth) から (tabs) へ抜けさせる。
    if (topSegment === AUTH_SEGMENT) {
      router.replace(TABS_ROUTE);
    }
  }, [uid, tutorialCompleted, segments, router]);

  useEffect(() => {
    hideSplashWhenReady();
  }, []);

  return (
    <>
      {children}
      {!bootMinimumElapsed ? <BootScreen /> : null}
    </>
  );
}

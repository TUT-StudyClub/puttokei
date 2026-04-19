/**
 * 認証状態 / プロフィール状態に応じたルーティングガード。
 *
 * - 未認証（uid == null）かつチュートリアル未完了 → `/(auth)/overview`
 * - 未認証だがチュートリアル完了済み → `(tabs)` への滞在を許可（ホーム画面を見せる）
 * - 認証済みだがプロフィール未設定（onboarding_completed == false） → `/(onboarding)/age-group`
 * - どちらも満たす → そのまま（tabs など）
 *
 * チュートリアル完了フラグはメモリ内 (Zustand) に保持するため、
 * アプリを再起動するたびにチュートリアルが再表示される。
 */
import { type Href, useRouter, useSegments } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';

import { useProfile } from '@/features/profile/hooks/useProfile';
import { BOOT_SCREEN_MIN_DURATION_MS, BootScreen } from '@/shared/components/BootScreen';
import { hideSplashWhenReady } from '@/shared/lib/splash';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

const AUTH_SEGMENT = '(auth)';
const ONBOARDING_SEGMENT = '(onboarding)';
const TABS_SEGMENT = '(tabs)';
const AUTH_OVERVIEW_ROUTE = '/(auth)/overview' as unknown as Href;

export function AuthGate({ children }: { children: ReactNode }) {
  const uid = useAuthStore((s) => s.uid);
  const tutorialCompleted = useTutorialStore((s) => s.completed);
  const { data: profile, isLoading } = useProfile();
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

    if (uid === null) {
      if (!tutorialCompleted) {
        // チュートリアル未完了は (auth) 配下に固定する
        if (topSegment !== AUTH_SEGMENT) {
          router.replace(AUTH_OVERVIEW_ROUTE);
        }
        return;
      }
      // チュートリアル完了済みなら (tabs) への滞在を許可。
      // それ以外のセグメント (例: onboarding) は overview に戻す。
      if (topSegment !== AUTH_SEGMENT && topSegment !== TABS_SEGMENT) {
        router.replace(AUTH_OVERVIEW_ROUTE);
      }
      return;
    }

    if (isLoading) return;

    if (profile !== undefined && !profile.onboarding_completed) {
      if (topSegment !== ONBOARDING_SEGMENT) {
        router.replace('/(onboarding)/age-group');
      }
      return;
    }

    if (profile !== undefined && profile.onboarding_completed) {
      if (topSegment === AUTH_SEGMENT || topSegment === ONBOARDING_SEGMENT) {
        router.replace('/(tabs)');
      }
    }
  }, [uid, tutorialCompleted, profile, isLoading, segments, router]);

  useEffect(() => {
    hideSplashWhenReady();
  }, []);

  const shouldShowBootScreen = !bootMinimumElapsed || (uid !== null && isLoading);

  return (
    <>
      {children}
      {shouldShowBootScreen ? <BootScreen /> : null}
    </>
  );
}

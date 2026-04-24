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
import { type Href, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { signOut } from '@/features/auth/lib/signOut';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { BOOT_SCREEN_MIN_DURATION_MS, BootScreen } from '@/shared/components/BootScreen';
import { ProfileErrorScreen } from '@/shared/components/ProfileErrorScreen';
import { isApiError } from '@/shared/lib/api';
import { hideSplashWhenReady } from '@/shared/lib/splash';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

const AUTH_SEGMENT = '(auth)';
const TABS_SEGMENT = '(tabs)';
const AUTH_OVERVIEW_ROUTE = '/(auth)/overview' as unknown as Href;
const TABS_ROUTE = '/(tabs)' as unknown as Href;
const RETURN_TO_ROUTES = new Set<string>(['/(tabs)/stats']);

function resolveReturnTo(returnTo: string | undefined): Href {
  if (returnTo !== undefined && RETURN_TO_ROUTES.has(returnTo)) {
    return returnTo as unknown as Href;
  }

  return TABS_ROUTE;
}

function resolveProfileErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return (
      error.problem?.detail ?? error.problem?.title ?? 'プロフィール API への接続に失敗しました。'
    );
  }

  if (error instanceof Error && error.message !== '') {
    return error.message;
  }

  return 'プロフィール API への接続に失敗しました。';
}

export function AuthGate({ children }: { children: ReactNode }) {
  const uid = useAuthStore((s) => s.uid);
  const tutorialCompleted = useTutorialStore((s) => s.completed);
  const router = useRouter();
  const segments = useSegments() as string[];
  const { returnTo } = useGlobalSearchParams<{ returnTo?: string }>();
  const [bootMinimumElapsed, setBootMinimumElapsed] = useState(false);
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const profileQuery = useProfile();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setBootMinimumElapsed(true);
    }, BOOT_SCREEN_MIN_DURATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // サインアウト / 再サインイン時に前回の一時エラー文言が居残らないようクリアする。
  useEffect(() => {
    if (uid === null) {
      setProfileActionError(null);
    }
  }, [uid]);

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

    // 3. 認証済 & チュートリアル完了 → (auth) から (tabs) または許可済み returnTo へ抜けさせる。
    if (topSegment === AUTH_SEGMENT) {
      router.replace(resolveReturnTo(returnTo));
    }
  }, [uid, tutorialCompleted, segments, router, returnTo]);

  useEffect(() => {
    hideSplashWhenReady();
  }, []);

  const handleProfileRetry = useCallback(() => {
    setProfileActionError(null);
    void profileQuery.refetch();
  }, [profileQuery]);

  const handleProfileSignOut = useCallback(async () => {
    setProfileActionError(null);
    try {
      await signOut();
    } catch (error) {
      const message =
        error instanceof Error && error.message !== ''
          ? error.message
          : 'サインアウトに失敗しました。時間をおいて再度お試しください。';
      setProfileActionError(message);
    }
  }, []);

  if (uid !== null && profileQuery.isError) {
    return (
      <>
        <ProfileErrorScreen
          message={profileActionError ?? resolveProfileErrorMessage(profileQuery.error)}
          onRetry={handleProfileRetry}
          onSignOut={handleProfileSignOut}
        />
        {!bootMinimumElapsed ? <BootScreen /> : null}
      </>
    );
  }

  return (
    <>
      {children}
      {!bootMinimumElapsed ? <BootScreen /> : null}
    </>
  );
}

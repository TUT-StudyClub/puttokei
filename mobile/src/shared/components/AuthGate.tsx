/**
 * 認証状態 / プロフィール状態に応じたルーティングガード。
 *
 * - 未認証（uid == null） → `/(auth)/sign-in`
 * - 認証済みだがプロフィール未設定（onboarding_completed == false） → `/(onboarding)/age-group`
 * - どちらも満たす → そのまま（tabs など）
 * - 認証済みだがプロフィール取得でエラー → エラー画面（再試行 / サインアウト）
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSegments } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';

import { signOut } from '@/features/auth/lib/signOut';
import { PROFILE_QUERY_KEY, useProfile } from '@/features/profile/hooks/useProfile';
import { BOOT_SCREEN_MIN_DURATION_MS, BootScreen } from '@/shared/components/BootScreen';
import { ProfileErrorScreen } from '@/shared/components/ProfileErrorScreen';
import { hideSplashWhenReady } from '@/shared/lib/splash';
import { useAuthStore } from '@/shared/stores/authStore';

const AUTH_SEGMENT = '(auth)';
const ONBOARDING_SEGMENT = '(onboarding)';

export function AuthGate({ children }: { children: ReactNode }) {
  const uid = useAuthStore((s) => s.uid);
  const { data: profile, isLoading, isError, error } = useProfile();
  const router = useRouter();
  const segments = useSegments();
  const queryClient = useQueryClient();
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
      if (topSegment !== AUTH_SEGMENT) {
        router.replace('/(auth)/sign-in');
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
  }, [uid, profile, isLoading, segments, router]);

  useEffect(() => {
    hideSplashWhenReady();
  }, []);

  const shouldShowBootScreen = !bootMinimumElapsed || (uid !== null && isLoading);
  const shouldShowProfileError = uid !== null && !isLoading && isError && profile === undefined;

  return (
    <>
      {children}
      {shouldShowBootScreen ? <BootScreen /> : null}
      {shouldShowProfileError ? (
        <ProfileErrorScreen
          message={error instanceof Error ? error.message : 'プロフィールを取得できませんでした'}
          onRetry={() => {
            queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
          }}
          onSignOut={async () => {
            // signOut が失敗したらサインアウトは成立していないため、
            // 成功確認後にキャッシュを破棄する。失敗時はエラー画面に留まって
            // ユーザが再度ボタンを押せる状態を保つ。
            try {
              await signOut();
              queryClient.removeQueries({ queryKey: PROFILE_QUERY_KEY });
            } catch (e) {
              console.warn('signOut failed', e);
            }
          }}
        />
      ) : null}
    </>
  );
}

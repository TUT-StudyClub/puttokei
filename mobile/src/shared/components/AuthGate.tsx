/**
 * 認証状態 / プロフィール状態に応じたルーティングガード。
 *
 * - 未認証（uid == null） → `/(auth)/sign-in`
 * - 認証済みだがプロフィール未設定（onboarding_completed == false） → `/(onboarding)/age-group`
 * - どちらも満たす → そのまま（tabs など）
 */
import { useRouter, useSegments } from 'expo-router';
import { type ReactNode, useEffect } from 'react';

import { useProfile } from '@/features/profile/hooks/useProfile';
import { useAuthStore } from '@/shared/stores/authStore';

const AUTH_SEGMENT = '(auth)';
const ONBOARDING_SEGMENT = '(onboarding)';

export function AuthGate({ children }: { children: ReactNode }) {
  const uid = useAuthStore((s) => s.uid);
  const { data: profile, isLoading } = useProfile();
  const router = useRouter();
  const segments = useSegments();

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

  return <>{children}</>;
}

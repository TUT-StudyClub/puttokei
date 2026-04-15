/**
 * 現在のユーザのプロフィールを取得する hook。
 * 未認証時（idToken が無い）は fetch しない。
 */
import { useQuery } from '@tanstack/react-query';

import { fetchMyProfile } from '@/features/profile/api/profileApi';
import { useAuthStore } from '@/shared/stores/authStore';
import type { UserProfile } from '@/shared/types/user';

export const PROFILE_QUERY_KEY = ['profile', 'me'] as const;

export function useProfile() {
  const idToken = useAuthStore((s) => s.idToken);
  return useQuery<UserProfile>({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchMyProfile,
    enabled: idToken !== null,
    staleTime: 60 * 1000,
  });
}

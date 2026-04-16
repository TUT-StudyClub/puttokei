/**
 * GET /users/me/settings を TanStack Query で取得する hook。
 * idToken が無いときは fetch しない（サインイン前は不要）。
 */
import { useQuery } from '@tanstack/react-query';

import { fetchMySettings } from '@/features/settings/api/settingsApi';
import { useAuthStore } from '@/shared/stores/authStore';
import type { UserSettings } from '@/shared/types/userSettings';

export const SETTINGS_QUERY_KEY = ['settings', 'me'] as const;

export function useSettings() {
  const idToken = useAuthStore((s) => s.idToken);
  return useQuery<UserSettings>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchMySettings,
    enabled: idToken !== null,
    staleTime: 60 * 1000,
  });
}

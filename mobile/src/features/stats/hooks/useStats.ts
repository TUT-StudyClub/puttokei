/**
 * 指定期間の学習統計を取得する hook。
 *
 * - period ごとに queryKey を分けているので、切替時に TanStack Query が自動で refetch する。
 * - 未認証時（idToken が無い）は fetch しない。
 */
import { useQuery } from '@tanstack/react-query';

import { fetchStatsByPeriod } from '@/features/stats/api/statsApi';
import type { Period, StatsPeriodResponse } from '@/features/stats/types';
import { ApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

export const STATS_QUERY_KEY = (period: Period) => ['stats', period] as const;

export function useStats(period: Period) {
  const idToken = useAuthStore((s) => s.idToken);
  return useQuery<StatsPeriodResponse, ApiError>({
    queryKey: STATS_QUERY_KEY(period),
    queryFn: () => fetchStatsByPeriod(period),
    enabled: idToken !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

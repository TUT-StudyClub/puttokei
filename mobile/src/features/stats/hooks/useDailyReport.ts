import { useQuery } from '@tanstack/react-query';

import { fetchDailyReport } from '@/features/stats/api/statsApi';
import type { DailyReportResponse } from '@/features/stats/types';
import { ApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

export const DAILY_REPORT_QUERY_KEY = (date: string) => ['stats', 'daily-report', date] as const;

export function useDailyReport(date: string) {
  const idToken = useAuthStore((s) => s.idToken);
  return useQuery<DailyReportResponse, ApiError>({
    queryKey: DAILY_REPORT_QUERY_KEY(date),
    queryFn: () => fetchDailyReport(date),
    enabled: idToken !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

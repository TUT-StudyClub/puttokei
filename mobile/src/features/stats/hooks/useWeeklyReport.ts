import { useQuery } from '@tanstack/react-query';

import { fetchWeeklyReport } from '@/features/stats/api/statsApi';
import type { WeeklyReportResponse } from '@/features/stats/types';
import { ApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

export const WEEKLY_REPORT_QUERY_KEY = (weekStart: string) =>
  ['stats', 'weekly-report', weekStart] as const;

export function useWeeklyReport(weekStart: string) {
  const idToken = useAuthStore((s) => s.idToken);
  return useQuery<WeeklyReportResponse, ApiError>({
    queryKey: WEEKLY_REPORT_QUERY_KEY(weekStart),
    queryFn: () => fetchWeeklyReport(weekStart),
    enabled: idToken !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

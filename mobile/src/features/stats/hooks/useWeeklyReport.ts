import { useQuery } from '@tanstack/react-query';

import { fetchWeeklyReport } from '@/features/stats/api/statsApi';
import type { WeeklyReportResponse } from '@/features/stats/types';
import { ApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

export const WEEKLY_REPORT_QUERY_KEY = (weekStart: string) =>
  ['stats', 'weekly-report', weekStart] as const;

type Options = {
  enabled?: boolean;
};

export function useWeeklyReport(weekStart: string, options?: Options) {
  const idToken = useAuthStore((s) => s.idToken);
  const callerEnabled = options?.enabled ?? true;
  return useQuery<WeeklyReportResponse, ApiError>({
    queryKey: WEEKLY_REPORT_QUERY_KEY(weekStart),
    queryFn: () => fetchWeeklyReport(weekStart),
    enabled: idToken !== null && callerEnabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

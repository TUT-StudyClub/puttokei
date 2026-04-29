import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchWeeklyReport } from '@/features/stats/api/statsApi';
import { WEEKLY_REPORT_QUERY_KEY } from '@/features/stats/hooks/useWeeklyReport';
import { getMonthWeekStartKeys } from '@/features/stats/lib/monthlyReport';
import { useAuthStore } from '@/shared/stores/authStore';

export function useMonthlyWeeklyReports(monthStartKey: string, enabled: boolean) {
  const idToken = useAuthStore((s) => s.idToken);
  const weekStarts = useMemo(() => getMonthWeekStartKeys(monthStartKey), [monthStartKey]);
  const queries = useQueries({
    queries: weekStarts.map((weekStart) => ({
      queryKey: WEEKLY_REPORT_QUERY_KEY(weekStart),
      queryFn: () => fetchWeeklyReport(weekStart),
      enabled: enabled && idToken !== null,
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });

  return {
    reports: queries.flatMap((query) => (query.data ? [query.data] : [])),
    error: queries.find((query) => query.isError)?.error,
    isPending: enabled && queries.some((query) => query.isPending),
    isError: enabled && queries.some((query) => query.isError),
    isFetching: enabled && queries.some((query) => query.isFetching),
    refetch: () => {
      queries.forEach((query) => {
        void query.refetch();
      });
    },
  };
}

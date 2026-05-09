import { useQuery } from '@tanstack/react-query';

import { listTodayOutputs } from '@/features/session/api/sessionApi';
import type { TodayOutputsResponse } from '@/features/session/types';
import type { ApiError } from '@/shared/lib/api';

export function useTodayOutputs(enabled = true) {
  return useQuery<TodayOutputsResponse, ApiError>({
    queryKey: ['sessions', 'outputs', 'today'],
    queryFn: listTodayOutputs,
    enabled,
    retry: false,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((item) => item.judgment === null) ? 3000 : false;
    },
  });
}

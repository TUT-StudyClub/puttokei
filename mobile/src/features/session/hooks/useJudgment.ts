import { useQuery } from '@tanstack/react-query';

import { getJudgment } from '@/features/session/api/sessionApi';
import type { JudgmentFetchResult } from '@/features/session/types';
import type { ApiError } from '@/shared/lib/api';

const JUDGMENT_POLLING_INTERVAL_MS = 5_000;

export function useJudgment(sessionId: string, enabled = true) {
  return useQuery<JudgmentFetchResult, ApiError>({
    queryKey: ['sessions', sessionId, 'judgment'],
    queryFn: () => getJudgment(sessionId),
    enabled: enabled && sessionId.length > 0,
    retry: false,
    refetchInterval: (query) =>
      enabled && query.state.data?.kind === 'pending' ? JUDGMENT_POLLING_INTERVAL_MS : false,
  });
}

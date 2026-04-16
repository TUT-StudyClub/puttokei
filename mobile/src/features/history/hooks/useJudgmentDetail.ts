import { useQuery } from '@tanstack/react-query';

import { getJudgmentDetail } from '@/features/history/api/judgmentApi';
import type { Judgment } from '@/features/session/types';
import type { ApiError } from '@/shared/lib/api';

export function useJudgmentDetail(judgmentId: string) {
  return useQuery<Judgment, ApiError>({
    queryKey: ['judgments', judgmentId],
    queryFn: () => getJudgmentDetail(judgmentId),
    enabled: judgmentId.length > 0,
    retry: false,
  });
}

import { useQuery } from '@tanstack/react-query';

import { getJudgmentDetail } from '@/features/history/api/judgmentApi';
import type { ApiError } from '@/shared/lib/api';
import type { Judgment } from '@/shared/types/session';

export function useJudgmentDetail(judgmentId: string) {
  return useQuery<Judgment, ApiError>({
    queryKey: ['judgments', judgmentId],
    queryFn: () => getJudgmentDetail(judgmentId),
    enabled: judgmentId.length > 0,
    retry: false,
  });
}

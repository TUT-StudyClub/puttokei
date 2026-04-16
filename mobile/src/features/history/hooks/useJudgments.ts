/**
 * 判定履歴一覧を取得する。
 */
import { useQuery } from '@tanstack/react-query';

import { listJudgments } from '@/features/history/api/judgmentApi';
import type { Judgment } from '@/features/session/types';
import type { ApiError } from '@/shared/lib/api';
import type { Paginated } from '@/shared/types/api';

export function useJudgments() {
  return useQuery<Paginated<Judgment>, ApiError>({
    queryKey: ['judgments'],
    queryFn: () => listJudgments(),
    retry: false,
  });
}

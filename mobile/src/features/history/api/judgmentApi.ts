/**
 * 判定履歴 API。
 */
import type { Judgment } from '@/features/session/types';
import { api } from '@/shared/lib/api';
import type { Cursor, Paginated } from '@/shared/types/api';

type JudgmentListResponse = {
  judgments: Judgment[];
  next_cursor: Cursor;
};

type JudgmentDetailResponse = {
  judgment: Judgment;
};

export async function listJudgments(cursor?: Cursor): Promise<Paginated<Judgment>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { data } = await api.get<JudgmentListResponse>(`/judgments${query}`);

  return {
    items: data.judgments,
    next_cursor: data.next_cursor,
  };
}

export async function getJudgmentDetail(judgmentId: string): Promise<Judgment> {
  const { data } = await api.get<JudgmentDetailResponse>(`/judgments/${judgmentId}`);
  return data.judgment;
}

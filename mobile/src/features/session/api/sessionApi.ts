/**
 * `/api/v1/sessions` 系の API 呼び出し。
 */
import { api } from '@/shared/lib/api';
import type {
  CreateSessionInput,
  Session,
  SessionStatus,
  SubmitOutputInput,
} from '@/features/session/types';

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const { data } = await api.post<Session>('/sessions', input);
  return data;
}

/**
 * フェーズ遷移に伴い session.status を更新する。
 * 許可される遷移はサーバ側の状態遷移表で絞り込まれる。
 */
export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): Promise<Session> {
  const { data } = await api.patch<Session>(`/sessions/${sessionId}`, { status });
  return data;
}

/**
 * アウトプット本文と送信時刻を backend に送る。
 * backend 側のレスポンス型が未確定のため、成功/失敗のみをハンドリングする。
 */
export async function submitOutput(sessionId: string, input: SubmitOutputInput): Promise<void> {
  await api.post<unknown>(`/sessions/${sessionId}/output`, input);
}

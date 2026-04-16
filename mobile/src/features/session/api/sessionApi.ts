/**
 * `/api/v1/sessions` 系の API 呼び出し。
 */
import { api } from '@/shared/lib/api';
import type {
  CreateSessionInput,
  Judgment,
  JudgmentFetchResult,
  JudgmentPending,
  Session,
  SessionStatus,
  SubmitOutputInput,
  SubmitOutputResponse,
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
 */
export async function submitOutput(
  sessionId: string,
  input: SubmitOutputInput,
): Promise<SubmitOutputResponse> {
  const { data } = await api.post<SubmitOutputResponse>(`/sessions/${sessionId}/output`, input);
  return data;
}

/**
 * 判定結果を取得する。未完了の場合は 202 pending を返す。
 */
export async function getJudgment(sessionId: string): Promise<JudgmentFetchResult> {
  const response = await api.get<Judgment | JudgmentPending>(`/sessions/${sessionId}/judgment`);

  if (response.status === 202) {
    return { kind: 'pending', pending: response.data as JudgmentPending };
  }

  return { kind: 'ready', judgment: response.data as Judgment };
}

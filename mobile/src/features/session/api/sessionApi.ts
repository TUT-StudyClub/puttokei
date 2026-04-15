/**
 * POST /api/v1/sessions の API 呼び出し。
 */
import { api } from '@/shared/lib/api';
import type { CreateSessionInput, Session } from '@/features/session/types';

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const { data } = await api.post<Session>('/sessions', input);
  return data;
}

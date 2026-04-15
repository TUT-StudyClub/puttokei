/**
 * PATCH /sessions/{id} のための useMutation hook。
 *
 * 成功時のナビゲーションは呼び出し側 (Screen) の `onSuccess` オプションで扱う。
 * この hook 自体は API 呼び出しと mutation 状態の提供だけに徹し、責務を単純化する。
 */
import { useMutation } from '@tanstack/react-query';

import { updateSessionStatus } from '@/features/session/api/sessionApi';
import type { Session, SessionStatus } from '@/features/session/types';

export type UpdateSessionStatusInput = {
  sessionId: string;
  status: SessionStatus;
};

export function useUpdateSessionStatus() {
  return useMutation<Session, Error, UpdateSessionStatusInput>({
    mutationFn: ({ sessionId, status }) => updateSessionStatus(sessionId, status),
  });
}

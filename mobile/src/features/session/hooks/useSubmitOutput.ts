/**
 * POST /sessions/{id}/output のための useMutation hook。
 *
 * - アウトプット本文と送信時刻を backend に送るだけの責務に絞る
 * - 送信成功後の PATCH status=judging や画面遷移は呼び出し側 (Screen) で扱う
 * - mutation の `isPending` を使って二重送信防止に利用する
 */
import { useMutation } from '@tanstack/react-query';

import { submitOutput } from '@/features/session/api/sessionApi';
import type { SubmitOutputInput, SubmitOutputResponse } from '@/features/session/types';

export type UseSubmitOutputInput = SubmitOutputInput & {
  sessionId: string;
};

export function useSubmitOutput() {
  return useMutation<SubmitOutputResponse, Error, UseSubmitOutputInput>({
    mutationFn: ({ sessionId, content, submitted_at }) =>
      submitOutput(sessionId, { content, submitted_at }),
  });
}

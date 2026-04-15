/**
 * POST /sessions のための useMutation hook。
 *
 * 成功時は作成された session のタイマー分数を URL クエリに積んで、
 * `/session/{id}/input` に push 遷移する。
 * 各フェーズ画面は URL クエリから分数を復元して `useTimer.start()` する。
 * （将来 GET /sessions/{id} を実装したらそちらに差し替える想定）
 */
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { createSession } from '@/features/session/api/sessionApi';
import type { CreateSessionInput, Session } from '@/features/session/types';

export function useCreateSession() {
  const router = useRouter();
  return useMutation<Session, Error, CreateSessionInput>({
    mutationFn: (input) => createSession(input),
    onSuccess: (session) => {
      router.push({
        pathname: '/session/[id]/input',
        params: {
          id: session.id,
          input: String(session.input_minutes),
          output: String(session.output_minutes),
          break: String(session.break_minutes),
        },
      });
    },
  });
}

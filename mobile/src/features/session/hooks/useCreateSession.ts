/**
 * POST /sessions のための useMutation hook。
 * 成功時はそのまま `/session/{id}/input` に push 遷移する。
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
      router.push(`/session/${session.id}/input`);
    },
  });
}

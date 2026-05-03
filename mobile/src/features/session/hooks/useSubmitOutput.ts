/**
 * アウトプット送信のための useMutation hook。
 *
 * - text の場合は本文と送信時刻を backend に送る
 * - image の場合は事前に GCS にアップロード済みの storage_path と送信時刻を送る
 * - 送信成功後の画面遷移は呼び出し側 (Screen) で扱う
 * - mutation の `isPending` を使って二重送信防止に利用する
 */
import { useMutation } from '@tanstack/react-query';

import { submitImageOutput, submitTextOutput } from '@/features/session/api/sessionApi';
import type { SubmitOutputResponse } from '@/features/session/types';

type SubmitTextVariables = {
  kind: 'text';
  sessionId: string;
  content: string;
  submitted_at: string;
};

type SubmitImageVariables = {
  kind: 'image';
  sessionId: string;
  image_storage_path: string;
  submitted_at: string;
};

export type UseSubmitOutputInput = SubmitTextVariables | SubmitImageVariables;

export function useSubmitOutput() {
  return useMutation<SubmitOutputResponse, Error, UseSubmitOutputInput>({
    mutationFn: async (variables) => {
      if (variables.kind === 'text') {
        return submitTextOutput(variables.sessionId, {
          content: variables.content,
          submitted_at: variables.submitted_at,
        });
      }
      return submitImageOutput(variables.sessionId, {
        image_storage_path: variables.image_storage_path,
        submitted_at: variables.submitted_at,
      });
    },
  });
}

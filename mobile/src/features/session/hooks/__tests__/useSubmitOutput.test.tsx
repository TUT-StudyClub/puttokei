/**
 * useSubmitOutput の振る舞いを検証する。
 *
 * mutation が `submitOutput(sessionId, { content, submitted_at })` を呼ぶこと、
 * 成功 / 失敗が mutation フラグ (isSuccess / isError / isPending) に反映されることを確認する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as sessionApi from '@/features/session/api/sessionApi';
import { useSubmitOutput } from '@/features/session/hooks/useSubmitOutput';

jest.mock('@/features/session/api/sessionApi');

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useSubmitOutput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mutate 呼び出しで submitOutput が正しい引数で呼ばれる', async () => {
    (sessionApi.submitOutput as jest.Mock).mockResolvedValue({
      status: 'judging',
      output: {
        id: 'out-1',
        session_id: 'ses-1',
        content: '本文',
        submitted_at: '2026-04-10T15:25:00.000Z',
      },
    });

    const { result } = renderHook(() => useSubmitOutput(), { wrapper });

    act(() => {
      result.current.mutate({
        sessionId: 'ses-1',
        content: '本文',
        submitted_at: '2026-04-10T15:25:00.000Z',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(sessionApi.submitOutput).toHaveBeenCalledWith('ses-1', {
      content: '本文',
      submitted_at: '2026-04-10T15:25:00.000Z',
    });
  });

  it('submitOutput が失敗すると isError が true になる', async () => {
    (sessionApi.submitOutput as jest.Mock).mockRejectedValue(new Error('HTTP 500'));

    const { result } = renderHook(() => useSubmitOutput(), { wrapper });

    act(() => {
      result.current.mutate({
        sessionId: 'ses-1',
        content: '本文',
        submitted_at: '2026-04-10T15:25:00.000Z',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

/**
 * useUpdateSessionStatus の振る舞いを検証する。
 *
 * mutation が `updateSessionStatus(sessionId, status)` を呼び、成功 / 失敗の
 * 状態が mutation フラグに反映されることを確認する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as sessionApi from '@/features/session/api/sessionApi';
import { useUpdateSessionStatus } from '@/features/session/hooks/useUpdateSessionStatus';

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

describe('useUpdateSessionStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mutate 呼び出しで updateSessionStatus が正しい引数で呼ばれる', async () => {
    (sessionApi.updateSessionStatus as jest.Mock).mockResolvedValue({
      id: 'ses-1',
      status: 'output',
    });

    const { result } = renderHook(() => useUpdateSessionStatus(), { wrapper });

    act(() => {
      result.current.mutate({ sessionId: 'ses-1', status: 'output' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(sessionApi.updateSessionStatus).toHaveBeenCalledWith('ses-1', 'output');
  });

  it('updateSessionStatus が失敗すると isError が true になる', async () => {
    (sessionApi.updateSessionStatus as jest.Mock).mockRejectedValue(new Error('HTTP 400'));

    const { result } = renderHook(() => useUpdateSessionStatus(), { wrapper });

    act(() => {
      result.current.mutate({ sessionId: 'ses-1', status: 'judged' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

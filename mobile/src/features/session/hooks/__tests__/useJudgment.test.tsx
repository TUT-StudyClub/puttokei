import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as sessionApi from '@/features/session/api/sessionApi';
import { useJudgment } from '@/features/session/hooks/useJudgment';

jest.mock('@/features/session/api/sessionApi');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useJudgment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enabled=false の間は判定結果を取得しない', () => {
    renderHook(() => useJudgment('ses-123', false), {
      wrapper: createWrapper(),
    });

    expect(sessionApi.getJudgment).not.toHaveBeenCalled();
  });

  it('enabled=true では判定結果を取得する', async () => {
    (sessionApi.getJudgment as jest.Mock).mockResolvedValue({
      kind: 'pending',
      pending: {
        status: 'pending',
        detail: '判定結果を準備しています。',
        retry_after_seconds: 5,
        estimated_ready_at: '2026-04-10T15:30:00.000Z',
      },
    });

    const { result } = renderHook(() => useJudgment('ses-123', true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(sessionApi.getJudgment).toHaveBeenCalledWith('ses-123');
    });
    await waitFor(() => {
      expect(result.current.data?.kind).toBe('pending');
    });
  });
});

/**
 * useSubmitOutput の振る舞いを検証する。
 *
 * text の場合は `submitTextOutput`、image の場合は `submitImageOutput` が
 * それぞれ正しい引数で呼ばれること、成功 / 失敗が mutation フラグに反映されることを確認する。
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

  it('text mutate で submitTextOutput が正しい引数で呼ばれる', async () => {
    (sessionApi.submitTextOutput as jest.Mock).mockResolvedValue({
      status: 'judging',
      output: {
        id: 'out-1',
        session_id: 'ses-1',
        kind: 'text',
        content: '本文',
        image_url: null,
        submitted_at: '2026-04-10T15:25:00.000Z',
      },
    });

    const { result } = renderHook(() => useSubmitOutput(), { wrapper });

    act(() => {
      result.current.mutate({
        kind: 'text',
        sessionId: 'ses-1',
        content: '本文',
        submitted_at: '2026-04-10T15:25:00.000Z',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(sessionApi.submitTextOutput).toHaveBeenCalledWith('ses-1', {
      content: '本文',
      submitted_at: '2026-04-10T15:25:00.000Z',
    });
  });

  it('image mutate で submitImageOutput が storage_path 付きで呼ばれる', async () => {
    (sessionApi.submitImageOutput as jest.Mock).mockResolvedValue({
      status: 'judging',
      output: {
        id: 'out-2',
        session_id: 'ses-1',
        kind: 'image',
        content: null,
        image_url: 'https://fake.storage/download/x',
        submitted_at: '2026-04-10T15:25:00.000Z',
      },
    });

    const { result } = renderHook(() => useSubmitOutput(), { wrapper });

    act(() => {
      result.current.mutate({
        kind: 'image',
        sessionId: 'ses-1',
        image_storage_path: 'outputs/uid/abc.jpg',
        submitted_at: '2026-04-10T15:25:00.000Z',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(sessionApi.submitImageOutput).toHaveBeenCalledWith('ses-1', {
      image_storage_path: 'outputs/uid/abc.jpg',
      submitted_at: '2026-04-10T15:25:00.000Z',
    });
  });

  it('text submit が失敗すると isError が true になる', async () => {
    (sessionApi.submitTextOutput as jest.Mock).mockRejectedValue(new Error('HTTP 500'));

    const { result } = renderHook(() => useSubmitOutput(), { wrapper });

    act(() => {
      result.current.mutate({
        kind: 'text',
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

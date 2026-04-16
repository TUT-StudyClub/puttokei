/**
 * useDeleteAccount の振る舞いを検証する。
 * 成功時に QueryClient のキャッシュ全消去と authStore のクリアが行われることを担保する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as settingsApi from '@/features/settings/api/settingsApi';
import { useDeleteAccount } from '@/features/settings/hooks/useDeleteAccount';
import { useAuthStore } from '@/shared/stores/authStore';

jest.mock('@/features/settings/api/settingsApi');

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe('useDeleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ uid: 'u-1', idToken: 'token-1' });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ uid: null, idToken: null });
  });

  it('mutate で deleteMyAccount を呼び、成功時に queryClient.clear() と authStore.clear() を実行する', async () => {
    (settingsApi.deleteMyAccount as jest.Mock).mockResolvedValue(undefined);
    const { queryClient, wrapper } = buildWrapper();
    queryClient.setQueryData(['profile', 'me'], { id: 'u-1' });

    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(settingsApi.deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
    expect(useAuthStore.getState().uid).toBeNull();
    expect(useAuthStore.getState().idToken).toBeNull();
  });
});

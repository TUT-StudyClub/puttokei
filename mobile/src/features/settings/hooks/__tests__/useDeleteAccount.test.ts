/**
 * useDeleteAccount の振る舞いを検証する。
 * 成功時に Firebase signOut → QueryClient のキャッシュ全消去 → authStore のクリアが
 * 行われることを担保する。signOut は failure を握り潰すが、finally で authStore は
 * clear される (signOut.ts の実装に依存)。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as signOutLib from '@/features/auth/lib/signOut';
import * as settingsApi from '@/features/settings/api/settingsApi';
import { useDeleteAccount } from '@/features/settings/hooks/useDeleteAccount';
import { useAuthStore } from '@/shared/stores/authStore';

jest.mock('@/features/settings/api/settingsApi');
// jest.mock の auto-mock では中で @react-native-firebase/auth が初期化されてしまうため、
// factory を渡して空 signOut だけを export する明示モックにする。
jest.mock('@/features/auth/lib/signOut', () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
}));

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
    act(() => {
      useAuthStore.setState({ uid: 'u-1', idToken: 'token-1' });
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
    });
  });

  it('mutate で deleteMyAccount を呼び、成功時に signOut → queryClient.clear() → authStore.clear() を実行する', async () => {
    (settingsApi.deleteMyAccount as jest.Mock).mockResolvedValue(undefined);
    // 本物の signOut を模倣して finally で authStore を clear する。
    (signOutLib.signOut as jest.Mock).mockImplementation(async () => {
      useAuthStore.getState().clear();
    });
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
    expect(signOutLib.signOut).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
    expect(useAuthStore.getState().uid).toBeNull();
    expect(useAuthStore.getState().idToken).toBeNull();
  });

  it('signOut が失敗してもエラーを握り潰し、queryClient.clear() は実行する', async () => {
    (settingsApi.deleteMyAccount as jest.Mock).mockResolvedValue(undefined);
    (signOutLib.signOut as jest.Mock).mockRejectedValue(new Error('firebase down'));
    const { queryClient, wrapper } = buildWrapper();
    queryClient.setQueryData(['profile', 'me'], { id: 'u-1' });

    const { result } = renderHook(() => useDeleteAccount(), { wrapper });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryClient.getQueryData(['profile', 'me'])).toBeUndefined();
  });
});

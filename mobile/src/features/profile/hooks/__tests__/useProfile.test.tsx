/**
 * useProfile の fetch 条件を検証する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as profileApi from '@/features/profile/api/profileApi';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useAuthStore } from '@/shared/stores/authStore';
import type { UserProfile } from '@/shared/types/user';

jest.mock('@/features/profile/api/profileApi');

const PROFILE_FIXTURE: UserProfile = {
  id: 'u-1',
  firebase_uid: 'fuid-1',
  auth_provider: 'google',
  display_name: '太郎',
  age_group: '30s',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null, isAnonymous: false });
    });
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null, isAnonymous: false });
    });
  });

  it('未認証ではプロフィールを取得しない', () => {
    (profileApi.fetchMyProfile as jest.Mock).mockResolvedValue(PROFILE_FIXTURE);

    const { result } = renderHook(() => useProfile(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(profileApi.fetchMyProfile).not.toHaveBeenCalled();
  });

  it('匿名認証ではプロフィールを取得しない', () => {
    act(() => {
      useAuthStore.setState({
        uid: 'anonymous-user',
        idToken: 'anonymous-token',
        isAnonymous: true,
      });
    });
    (profileApi.fetchMyProfile as jest.Mock).mockResolvedValue(PROFILE_FIXTURE);

    const { result } = renderHook(() => useProfile(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(profileApi.fetchMyProfile).not.toHaveBeenCalled();
  });

  it('正式認証ではプロフィールを取得する', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'u-1', idToken: 'token-1', isAnonymous: false });
    });
    (profileApi.fetchMyProfile as jest.Mock).mockResolvedValue(PROFILE_FIXTURE);

    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(profileApi.fetchMyProfile).toHaveBeenCalledTimes(1);
  });
});

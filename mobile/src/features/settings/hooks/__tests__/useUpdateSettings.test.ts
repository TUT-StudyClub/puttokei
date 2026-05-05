/**
 * useUpdateSettings の振る舞いを検証する。
 * mutationFn が settingsApi.updateMySettings を呼ぶことと、
 * 成功時に SETTINGS_QUERY_KEY のキャッシュへ反映されることを担保する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as settingsApi from '@/features/settings/api/settingsApi';
import { SETTINGS_QUERY_KEY } from '@/features/settings/hooks/useSettings';
import { useUpdateSettings } from '@/features/settings/hooks/useUpdateSettings';
import * as notifications from '@/shared/lib/notifications';
import type { UserSettings } from '@/shared/types/userSettings';

jest.mock('@/features/settings/api/settingsApi');
jest.mock('@/shared/lib/notifications', () => ({
  cancelAllScheduledSessionNotifications: jest.fn().mockResolvedValue(undefined),
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

describe('useUpdateSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('mutate で updateMySettings を呼び出し、成功時に SETTINGS_QUERY_KEY のキャッシュを更新する', async () => {
    const updated: UserSettings = {
      input_minutes: 30,
      output_minutes: 5,
      break_minutes: 5,
      notification_enabled: true,
      updated_at: '2026-04-16T00:00:00Z',
    };
    (settingsApi.updateMySettings as jest.Mock).mockResolvedValue(updated);
    const { queryClient, wrapper } = buildWrapper();

    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => {
      result.current.mutate({ input_minutes: 30 });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(settingsApi.updateMySettings).toHaveBeenCalledWith({ input_minutes: 30 });
    await waitFor(() => {
      expect(queryClient.getQueryData<UserSettings>(SETTINGS_QUERY_KEY)).toEqual(updated);
    });
    expect(notifications.cancelAllScheduledSessionNotifications).not.toHaveBeenCalled();
  });

  it('notification_enabled=false へ切り替わった成功レスポンスでは予約済み通知をキャンセルする', async () => {
    const updated: UserSettings = {
      input_minutes: 20,
      output_minutes: 5,
      break_minutes: 5,
      notification_enabled: false,
      updated_at: '2026-04-16T00:00:00Z',
    };
    (settingsApi.updateMySettings as jest.Mock).mockResolvedValue(updated);
    const { wrapper } = buildWrapper();

    const { result } = renderHook(() => useUpdateSettings(), { wrapper });

    act(() => {
      result.current.mutate({ notification_enabled: false });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(notifications.cancelAllScheduledSessionNotifications).toHaveBeenCalledTimes(1);
  });
});

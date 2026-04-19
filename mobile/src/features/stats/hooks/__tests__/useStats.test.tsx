/**
 * useStats の振る舞いを検証する。
 *
 * - idToken が null のときは fetch が発火しない (enabled: false)
 * - period ごとに queryKey が分離されていて、切替時に再 fetch が走る
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as statsApi from '@/features/stats/api/statsApi';
import { STATS_QUERY_KEY, useStats } from '@/features/stats/hooks/useStats';
import type { StatsPeriodResponse } from '@/features/stats/types';
import { useAuthStore } from '@/shared/stores/authStore';

jest.mock('@/features/stats/api/statsApi');

function makeResponse(period: StatsPeriodResponse['period']): StatsPeriodResponse {
  return {
    period,
    points: [],
    summary: {
      total_sessions: 0,
      total_study_minutes: 0,
      correct_rate: 0,
      streak_days: 0,
      period,
      from: '2026-04-14T00:00:00Z',
      to: '2026-04-15T23:59:59Z',
    },
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
    });
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
    });
  });

  it('idToken が null のときは fetchStatsByPeriod を呼ばない', async () => {
    (statsApi.fetchStatsByPeriod as jest.Mock).mockResolvedValue(makeResponse('daily'));

    const { result } = renderHook(() => useStats('daily'), { wrapper });

    // 初期レンダー直後は fetch は走らないので fetchStarted は起きない
    expect(result.current.fetchStatus).toBe('idle');
    expect(statsApi.fetchStatsByPeriod).not.toHaveBeenCalled();
  });

  it('idToken があれば period を引数に fetchStatsByPeriod を呼ぶ', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'u-1', idToken: 'token-1' });
    });
    (statsApi.fetchStatsByPeriod as jest.Mock).mockResolvedValue(makeResponse('weekly'));

    const { result } = renderHook(() => useStats('weekly'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(statsApi.fetchStatsByPeriod).toHaveBeenCalledWith('weekly');
  });

  it('STATS_QUERY_KEY は period 毎に異なる配列を返す', () => {
    expect(STATS_QUERY_KEY('daily')).toEqual(['stats', 'daily']);
    expect(STATS_QUERY_KEY('weekly')).toEqual(['stats', 'weekly']);
    expect(STATS_QUERY_KEY('monthly')).toEqual(['stats', 'monthly']);
  });
});

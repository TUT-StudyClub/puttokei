/**
 * StatsScreen の主要な振る舞いを検証する。
 *
 * - 初期表示で daily が fetch される
 * - 期間ボタンを押すと対応する period で fetch され直す
 * - 取得失敗時は error UI と retry ボタンが出る
 * - 空データ時は empty UI が出る
 *
 * react-native-gifted-charts の BarChart は native 依存を含むため、
 * jest.mock でダミーコンポーネントに差し替える。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as statsApi from '@/features/stats/api/statsApi';
import { StatsScreen } from '@/features/stats/screens/StatsScreen';
import type { StatsPeriodResponse } from '@/features/stats/types';
import { ApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

jest.mock('@/features/stats/api/statsApi');

jest.mock('react-native-gifted-charts', () => ({
  BarChart: () => null,
}));

function makeResponse(
  overrides: Partial<StatsPeriodResponse> = {},
  period: StatsPeriodResponse['period'] = 'daily',
): StatsPeriodResponse {
  return {
    period,
    points: [
      { bucket: '2026-04-14', label: '4/14', sessions: 2, study_minutes: 50, correct_rate: 0.8 },
      { bucket: '2026-04-15', label: '4/15', sessions: 3, study_minutes: 75, correct_rate: 0.6 },
    ],
    summary: {
      total_sessions: 5,
      total_study_minutes: 125,
      correct_rate: 0.7,
      streak_days: 3,
      period,
      from: '2026-04-14T00:00:00Z',
      to: '2026-04-15T23:59:59Z',
    },
    ...overrides,
  };
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </TamaguiProvider>,
  );
}

async function flushAsyncUpdates() {
  await act(async () => {});
  act(() => {
    jest.runOnlyPendingTimers();
  });
}

describe('StatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    act(() => {
      useAuthStore.setState({ uid: 'u-1', idToken: 'token-1' });
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
    });
    jest.useRealTimers();
  });

  it('初期表示で daily の fetchStatsByPeriod が呼ばれてサマリーが表示される', async () => {
    (statsApi.fetchStatsByPeriod as jest.Mock).mockResolvedValue(makeResponse());

    const { getByTestId } = renderWithProviders(<StatsScreen />);

    await waitFor(() => {
      expect(statsApi.fetchStatsByPeriod).toHaveBeenCalledWith('daily');
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-summary-sessions')).toBeTruthy();
    });
  });

  it('週ボタン押下で fetchStatsByPeriod が weekly で呼ばれる', async () => {
    (statsApi.fetchStatsByPeriod as jest.Mock).mockImplementation((p) =>
      Promise.resolve(makeResponse({}, p)),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchStatsByPeriod).toHaveBeenCalledWith('daily');
    });

    await act(async () => {
      fireEvent.press(getByTestId('stats-period-weekly'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchStatsByPeriod).toHaveBeenCalledWith('weekly');
    });
  });

  it('取得失敗時は error メッセージと retry ボタンが表示される', async () => {
    (statsApi.fetchStatsByPeriod as jest.Mock).mockRejectedValue(
      new ApiError(500, {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: '一時的な障害です',
      }),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-error-message').props.children).toBe('一時的な障害です');
    });
    expect(getByTestId('stats-retry')).toBeTruthy();
  });

  it('空データの場合は empty メッセージが表示される', async () => {
    (statsApi.fetchStatsByPeriod as jest.Mock).mockResolvedValue(
      makeResponse({
        points: [],
        summary: {
          total_sessions: 0,
          total_study_minutes: 0,
          correct_rate: 0,
          streak_days: 0,
          period: 'daily',
          from: '2026-04-14T00:00:00Z',
          to: '2026-04-15T23:59:59Z',
        },
      }),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-empty-message')).toBeTruthy();
    });
  });
});

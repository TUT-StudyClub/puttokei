/**
 * StatsScreen の週単位レポート表示を検証する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as statsApi from '@/features/stats/api/statsApi';
import { StatsScreen } from '@/features/stats/screens/StatsScreen';
import type { WeeklyReportResponse } from '@/features/stats/types';
import { ApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

jest.mock('@/features/stats/api/statsApi');

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: unknown }) => {
    const { Text } = require('react-native');
    return <Text testID="stats-redirect">{JSON.stringify(href)}</Text>;
  },
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('react-native-gifted-charts', () => ({
  BarChart: () => {
    const { View } = require('react-native');
    return <View testID="mock-bar-chart" />;
  },
}));

function makeWeeklyResponse(overrides: Partial<WeeklyReportResponse> = {}): WeeklyReportResponse {
  const base: WeeklyReportResponse = {
    week_start: '2026-04-26',
    week_end: '2026-05-02',
    summary: {
      input_minutes: 100,
      output_minutes: 25,
      break_minutes: 25,
      total_study_minutes: 125,
      total_sessions: 5,
    },
    points: [
      { bucket: '2026-04-26', label: '26', study_minutes: 25, sessions: 1 },
      { bucket: '2026-04-27', label: '27', study_minutes: 50, sessions: 2 },
      { bucket: '2026-04-28', label: '28', study_minutes: 50, sessions: 2 },
      { bucket: '2026-04-29', label: '29', study_minutes: 0, sessions: 0 },
      { bucket: '2026-04-30', label: '30', study_minutes: 0, sessions: 0 },
      { bucket: '2026-05-01', label: '1', study_minutes: 0, sessions: 0 },
      { bucket: '2026-05-02', label: '2', study_minutes: 0, sessions: 0 },
    ],
    output_history: [
      {
        session_id: 'ses-1',
        output: {
          id: 'out-1',
          session_id: 'ses-1',
          content: '関係代名詞は先行詞を修飾する表現です。',
          submitted_at: '2026-04-26T01:00:00Z',
        },
        cycle_index: 1,
        subject: '英語',
        topic: '関係代名詞',
        judgment: {
          id: 'judgment-1',
          session_id: 'ses-1',
          verdict: 'partial',
          score: 80,
          advice: '要点は整理できています。',
          corrections: [],
          judged_at: '2026-04-26T01:05:00Z',
        },
      },
    ],
  };

  return {
    ...base,
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
    jest.setSystemTime(new Date('2026-04-29T00:00:00Z'));
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

  it('未認証の場合はサインインへ遷移し、週次レポートを取得しない', () => {
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
    });

    const { getByTestId } = renderWithProviders(<StatsScreen />);

    expect(getByTestId('stats-redirect').props.children).toBe(
      JSON.stringify({
        pathname: '/(auth)/sign-in',
        params: { returnTo: '/(tabs)/stats' },
      }),
    );
    expect(statsApi.fetchWeeklyReport).not.toHaveBeenCalled();
  });

  it('初期表示で現在週のレポートを取得し、ハイライト・グラフ・履歴を表示する', async () => {
    (statsApi.fetchWeeklyReport as jest.Mock).mockResolvedValue(makeWeeklyResponse());

    const { getByTestId, getByText } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchWeeklyReport).toHaveBeenCalledWith('2026-04-26');
    });
    await waitFor(() => {
      expect(getByTestId('stats-highlight-card')).toBeTruthy();
    });
    expect(getByTestId('stats-weekly-chart')).toBeTruthy();
    expect(getByTestId('mock-bar-chart')).toBeTruthy();
    expect(getByTestId('stats-output-history-item-out-1')).toBeTruthy();
    expect(getByText('4月')).toBeTruthy();
  });

  it('右矢印押下で翌週のレポートを取得する', async () => {
    (statsApi.fetchWeeklyReport as jest.Mock).mockImplementation((weekStart: string) =>
      Promise.resolve(makeWeeklyResponse({ week_start: weekStart })),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchWeeklyReport).toHaveBeenCalledWith('2026-04-26');
    });

    await act(async () => {
      fireEvent.press(getByTestId('week-date-next'));
    });
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(statsApi.fetchWeeklyReport).toHaveBeenCalledWith('2026-05-03');
    });
  });

  it('取得失敗時は error メッセージと retry ボタンが表示される', async () => {
    (statsApi.fetchWeeklyReport as jest.Mock).mockRejectedValue(
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

  it('一週間のアウトプット履歴が空の場合は empty メッセージが表示される', async () => {
    (statsApi.fetchWeeklyReport as jest.Mock).mockResolvedValue(
      makeWeeklyResponse({
        summary: {
          input_minutes: 0,
          output_minutes: 0,
          break_minutes: 0,
          total_study_minutes: 0,
          total_sessions: 0,
        },
        points: [
          { bucket: '2026-04-26', label: '26', study_minutes: 0, sessions: 0 },
          { bucket: '2026-04-27', label: '27', study_minutes: 0, sessions: 0 },
          { bucket: '2026-04-28', label: '28', study_minutes: 0, sessions: 0 },
          { bucket: '2026-04-29', label: '29', study_minutes: 0, sessions: 0 },
          { bucket: '2026-04-30', label: '30', study_minutes: 0, sessions: 0 },
          { bucket: '2026-05-01', label: '1', study_minutes: 0, sessions: 0 },
          { bucket: '2026-05-02', label: '2', study_minutes: 0, sessions: 0 },
        ],
        output_history: [],
      }),
    );

    const { getByTestId } = renderWithProviders(<StatsScreen />);
    await flushAsyncUpdates();

    await waitFor(() => {
      expect(getByTestId('stats-output-history-empty')).toBeTruthy();
    });
  });
});

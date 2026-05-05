import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as judgmentApi from '@/features/history/api/judgmentApi';
import { HistoryScreen } from '@/features/history/screens/HistoryScreen';
import { ApiError } from '@/shared/lib/api';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/features/history/api/judgmentApi');

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

describe('HistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it('一覧が表示され、item 押下で詳細へ遷移する', async () => {
    (judgmentApi.listJudgments as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'jdg-1',
          session_id: 'ses-1',
          verdict: 'partial',
          score: 72,
          advice: 'もう少し具体例を増やすと安定します。',
          corrections: [
            {
              target_text: '明智光秀',
              correct_text: '織田信長は本能寺の変で死んだ',
              explanation: '本能寺の変で死亡したのは織田信長です。',
            },
          ],
          judged_at: '2026-04-10T15:30:00.000Z',
        },
        {
          id: 'jdg-2',
          session_id: 'ses-2',
          verdict: 'correct',
          score: 91,
          advice: '十分に整理されています。',
          corrections: [],
          judged_at: '2026-04-11T15:30:00.000Z',
        },
      ],
      next_cursor: null,
    });

    const { getByTestId, getByText } = renderWithProviders(<HistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('history-item-jdg-1')).toBeTruthy();
    });
    expect(getByText('判定履歴')).toBeTruthy();

    fireEvent.press(getByTestId('history-item-jdg-1'));
    expect(mockPush).toHaveBeenCalledWith('../history/jdg-1');
  });

  it('履歴が空のときは空状態を表示する', async () => {
    (judgmentApi.listJudgments as jest.Mock).mockResolvedValue({
      items: [],
      next_cursor: null,
    });

    const { getByTestId } = renderWithProviders(<HistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('history-empty-message')).toBeTruthy();
    });
  });

  it('取得失敗時はエラーメッセージと再取得ボタンを表示する', async () => {
    (judgmentApi.listJudgments as jest.Mock).mockRejectedValue(
      new ApiError(500, {
        type: 'server_error',
        title: 'Server Error',
        status: 500,
        detail: 'history fetch failed',
      }),
    );

    const { getByTestId } = renderWithProviders(<HistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('history-error-message')).toBeTruthy();
    });
    expect(getByTestId('history-retry')).toBeTruthy();
  });

  it('初回取得中はローディング状態を表示する', () => {
    (judgmentApi.listJudgments as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    const { getByTestId } = renderWithProviders(<HistoryScreen />);

    expect(getByTestId('history-loading')).toBeTruthy();
  });
});

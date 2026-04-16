import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as judgmentApi from '@/features/history/api/judgmentApi';
import { HistoryDetailScreen } from '@/features/history/screens/HistoryDetailScreen';
import { ApiError } from '@/shared/lib/api';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'jdg-1' }),
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

describe('HistoryDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('詳細取得成功時は score / advice / items を表示する', async () => {
    (judgmentApi.getJudgmentDetail as jest.Mock).mockResolvedValue({
      id: 'jdg-1',
      session_id: 'ses-1',
      verdict: 'partial',
      score: 72,
      advice: 'もう少し具体例を増やすと安定します。',
      items: [
        { label: '理解度', comment: '要点は押さえられています。' },
        { label: '具体例', comment: '例があるとさらに伝わります。' },
      ],
      judged_at: '2026-04-10T15:30:00.000Z',
    });

    const { getByTestId, getByText } = renderWithProviders(<HistoryDetailScreen />);

    await waitFor(() => {
      expect(getByTestId('history-detail-summary')).toBeTruthy();
    });
    expect(getByTestId('judgment-card')).toBeTruthy();
    expect(getByText('スコア: 72')).toBeTruthy();
    expect(getByText('具体例')).toBeTruthy();
  });

  it('取得失敗時はエラーメッセージと再取得ボタンを表示する', async () => {
    (judgmentApi.getJudgmentDetail as jest.Mock).mockRejectedValue(
      new ApiError(404, {
        type: 'not_found',
        title: 'Not Found',
        status: 404,
        detail: 'judgment not found',
      }),
    );

    const { getByTestId } = renderWithProviders(<HistoryDetailScreen />);

    await waitFor(() => {
      expect(getByTestId('history-detail-error-message')).toBeTruthy();
    });
    expect(getByTestId('history-detail-retry')).toBeTruthy();
  });

  it('「一覧へ戻る」押下で back 遷移する', async () => {
    (judgmentApi.getJudgmentDetail as jest.Mock).mockResolvedValue({
      id: 'jdg-1',
      session_id: 'ses-1',
      verdict: 'correct',
      score: 91,
      advice: '十分に整理されています。',
      items: [{ label: '再現性', comment: '説明が具体的です。' }],
      judged_at: '2026-04-10T15:30:00.000Z',
    });

    const { getByTestId } = renderWithProviders(<HistoryDetailScreen />);

    await waitFor(() => {
      expect(getByTestId('history-detail-back')).toBeTruthy();
    });
    fireEvent.press(getByTestId('history-detail-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('初回取得中はローディング状態を表示する', () => {
    (judgmentApi.getJudgmentDetail as jest.Mock).mockImplementation(
      () => new Promise(() => undefined),
    );

    const { getByTestId } = renderWithProviders(<HistoryDetailScreen />);

    expect(getByTestId('history-detail-loading')).toBeTruthy();
  });
});

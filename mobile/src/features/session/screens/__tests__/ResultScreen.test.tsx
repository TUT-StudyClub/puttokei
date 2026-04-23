/**
 * ResultScreen の振る舞いを検証する。
 * ready / pending / error / rejected を出し分ける。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import { ResultScreen } from '@/features/session/screens/ResultScreen';
import { ApiError } from '@/shared/lib/api';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'ses-123' }),
}));

jest.mock('@/features/session/api/sessionApi');

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

describe('ResultScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ready 判定では JudgmentCard と「ホームへ戻る」ボタンが表示される', async () => {
    (sessionApi.getJudgment as jest.Mock).mockResolvedValue({
      kind: 'ready',
      judgment: {
        id: 'jdg-1',
        session_id: 'ses-123',
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
    });

    const { getByTestId, getByText } = renderWithProviders(<ResultScreen />);

    await waitFor(() => {
      expect(getByTestId('judgment-card')).toBeTruthy();
    });
    expect(getByText('判定結果')).toBeTruthy();
    expect(getByTestId('result-back-home')).toBeTruthy();
  });

  it('pending 判定では待機メッセージと再確認ボタンが表示される', async () => {
    (sessionApi.getJudgment as jest.Mock).mockResolvedValue({
      kind: 'pending',
      pending: {
        status: 'pending',
        detail: '判定結果を準備しています。',
        retry_after_seconds: 5,
        estimated_ready_at: '2026-04-10T15:30:00.000Z',
      },
    });

    const { getByTestId } = renderWithProviders(<ResultScreen />);

    await waitFor(() => {
      expect(getByTestId('result-pending-detail')).toBeTruthy();
    });
    expect(getByTestId('result-refetch')).toBeTruthy();
  });

  it('error では Problem Details の detail と再試行ボタンが表示される', async () => {
    (sessionApi.getJudgment as jest.Mock).mockRejectedValue(
      new ApiError(409, {
        type: 'output_not_submitted',
        title: 'Output Not Submitted',
        status: 409,
        detail: 'output not submitted',
      }),
    );

    const { getByTestId } = renderWithProviders(<ResultScreen />);

    await waitFor(() => {
      expect(getByTestId('result-error-message')).toBeTruthy();
    });
    expect(getByTestId('result-retry')).toBeTruthy();
  });

  it('rejected 判定では専用メッセージを表示する', async () => {
    (sessionApi.getJudgment as jest.Mock).mockResolvedValue({
      kind: 'ready',
      judgment: {
        id: 'jdg-2',
        session_id: 'ses-123',
        verdict: 'rejected',
        score: 0,
        advice: '学習内容をもう少し具体的に書いてください。',
        corrections: [],
        judged_at: '2026-04-10T15:30:00.000Z',
      },
    });

    const { getByTestId } = renderWithProviders(<ResultScreen />);

    await waitFor(() => {
      expect(getByTestId('result-rejected-message')).toBeTruthy();
    });
  });

  it('「ホームへ戻る」押下で `/(tabs)` に replace 遷移する', async () => {
    (sessionApi.getJudgment as jest.Mock).mockResolvedValue({
      kind: 'ready',
      judgment: {
        id: 'jdg-1',
        session_id: 'ses-123',
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
    });

    const { getByTestId } = renderWithProviders(<ResultScreen />);

    await waitFor(() => {
      expect(getByTestId('result-back-home')).toBeTruthy();
    });
    fireEvent.press(getByTestId('result-back-home'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});

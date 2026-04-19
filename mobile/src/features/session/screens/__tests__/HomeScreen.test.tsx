/**
 * HomeScreen の基本的な振る舞いを検証する。
 *
 * 現状の HomeScreen は subject / topic 入力 UI を持たず、
 * デフォルト値 (DEFAULT_TIMER) でセッションを開始するプレースホルダー実装になっている。
 * フェーズタブでインプット / アウトプット / 休憩 の表示時間が切り替わることと、
 * スタート押下で createSession が呼ばれて遷移することを検証する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import { DEFAULT_TIMER } from '@/features/session/config';
import { HomeScreen } from '@/features/session/screens/HomeScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期表示はインプットの時間を表示する', () => {
    const { getByTestId } = renderWithProviders(<HomeScreen />);
    expect(getByTestId('home-timer-text').props.children).toBe(
      `${String(DEFAULT_TIMER.input_minutes).padStart(2, '0')}:00`,
    );
  });

  it('フェーズタブを切り替えると表示時間が切り替わる', () => {
    const { getByTestId } = renderWithProviders(<HomeScreen />);

    fireEvent.press(getByTestId('home-phase-tab-output'));
    expect(getByTestId('home-timer-text').props.children).toBe(
      `${String(DEFAULT_TIMER.output_minutes).padStart(2, '0')}:00`,
    );

    fireEvent.press(getByTestId('home-phase-tab-break'));
    expect(getByTestId('home-timer-text').props.children).toBe(
      `${String(DEFAULT_TIMER.break_minutes).padStart(2, '0')}:00`,
    );

    fireEvent.press(getByTestId('home-phase-tab-input'));
    expect(getByTestId('home-timer-text').props.children).toBe(
      `${String(DEFAULT_TIMER.input_minutes).padStart(2, '0')}:00`,
    );
  });

  it('スタート押下で createSession がデフォルト値で呼ばれ、成功時に push 遷移する', async () => {
    (sessionApi.createSession as jest.Mock).mockResolvedValue({
      id: 'ses-123',
      user_id: 'usr-1',
      status: 'input',
      subject: '未設定',
      topic: '未設定',
      input_minutes: DEFAULT_TIMER.input_minutes,
      output_minutes: DEFAULT_TIMER.output_minutes,
      break_minutes: DEFAULT_TIMER.break_minutes,
      started_at: '2026-04-15T10:00:00Z',
      completed_at: null,
      created_at: '2026-04-15T10:00:00Z',
    });

    const { getByTestId } = renderWithProviders(<HomeScreen />);
    fireEvent.press(getByTestId('home-start-button'));

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalledWith({
        subject: '未設定',
        topic: '未設定',
        input_minutes: DEFAULT_TIMER.input_minutes,
        output_minutes: DEFAULT_TIMER.output_minutes,
        break_minutes: DEFAULT_TIMER.break_minutes,
      });
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/session/[id]/input',
        params: {
          id: 'ses-123',
          input: String(DEFAULT_TIMER.input_minutes),
          output: String(DEFAULT_TIMER.output_minutes),
          break: String(DEFAULT_TIMER.break_minutes),
        },
      });
    });
  });

  it('createSession が失敗するとエラー文言が表示される', async () => {
    (sessionApi.createSession as jest.Mock).mockRejectedValue(new Error('HTTP 500'));

    const { getByTestId, findByText } = renderWithProviders(<HomeScreen />);
    fireEvent.press(getByTestId('home-start-button'));

    expect(await findByText(/セッションの開始に失敗しました/)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

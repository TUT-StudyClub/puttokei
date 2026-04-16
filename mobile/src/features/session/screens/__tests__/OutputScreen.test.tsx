/**
 * OutputScreen の振る舞いを検証する。
 *
 * - マウント時に phase=output のタイマーが start される
 * - タイマー完了で PATCH status=judging → break 画面へ replace する
 * - OutputEditor で本文を入力 → 送信すると submitOutput → PATCH status=judging → break へ replace
 * - submitOutput が失敗するとエラーメッセージが表示され、再度送信できる (二重送信防止の挙動含む)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import { OutputScreen } from '@/features/session/screens/OutputScreen';
import { useTimerStore } from '@/shared/stores/timerStore';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({
    id: 'ses-123',
    output: '1',
    break: '5',
  }),
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

describe('OutputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTimerStore.setState({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      completionToken: 0,
    });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-10T15:25:00.000Z'));
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('マウントで phase=output のタイマーが開始され、タイトルが表示される', () => {
    const { getByText } = renderWithProviders(<OutputScreen />);
    expect(getByText('アウトプット')).toBeTruthy();
    expect(useTimerStore.getState().phase).toBe('output');
    expect(useTimerStore.getState().totalSeconds).toBe(60);
  });

  it('タイマー完了で PATCH status=judging が送られ、break 画面へ replace する', async () => {
    (sessionApi.updateSessionStatus as jest.Mock).mockResolvedValue({
      id: 'ses-123',
      status: 'judging',
    });

    renderWithProviders(<OutputScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(sessionApi.updateSessionStatus).toHaveBeenCalledWith('ses-123', 'judging');
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/break',
        params: { id: 'ses-123', break: '5' },
      });
    });
    expect(sessionApi.submitOutput).not.toHaveBeenCalled();
  });

  it('本文入力 → 送信で submitOutput → PATCH judging → break 画面へ replace する', async () => {
    (sessionApi.submitOutput as jest.Mock).mockResolvedValue(undefined);
    (sessionApi.updateSessionStatus as jest.Mock).mockResolvedValue({
      id: 'ses-123',
      status: 'judging',
    });

    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.changeText(getByTestId('output-editor-textarea'), '関係代名詞は先行詞を修飾する');

    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });

    await waitFor(() => {
      expect(sessionApi.submitOutput).toHaveBeenCalledWith('ses-123', {
        content: '関係代名詞は先行詞を修飾する',
        submitted_at: '2026-04-10T15:25:00.000Z',
      });
    });
    await waitFor(() => {
      expect(sessionApi.updateSessionStatus).toHaveBeenCalledWith('ses-123', 'judging');
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/break',
        params: { id: 'ses-123', break: '5' },
      });
    });
  });

  it('submitOutput 失敗時はエラーメッセージと「再送する」ボタンが現れ、明示操作で再送できる', async () => {
    (sessionApi.submitOutput as jest.Mock)
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockResolvedValueOnce(undefined);
    (sessionApi.updateSessionStatus as jest.Mock).mockResolvedValue({
      id: 'ses-123',
      status: 'judging',
    });

    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.changeText(getByTestId('output-editor-textarea'), '本文');

    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });

    await waitFor(() => {
      expect(getByTestId('output-editor-error')).toBeTruthy();
    });
    expect(sessionApi.updateSessionStatus).not.toHaveBeenCalled();

    // 失敗後「送信する」ボタンを連打しても再送されない (連打抑止)
    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
      fireEvent.press(getByTestId('output-editor-submit'));
    });
    expect(sessionApi.submitOutput).toHaveBeenCalledTimes(1);

    // 「再送する」ボタンの明示操作のみ再送される
    act(() => {
      fireEvent.press(getByTestId('output-editor-retry'));
    });

    await waitFor(() => {
      expect(sessionApi.submitOutput).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/break',
        params: { id: 'ses-123', break: '5' },
      });
    });
  });
});

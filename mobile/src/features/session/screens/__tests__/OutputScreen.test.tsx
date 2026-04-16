/**
 * OutputScreen の振る舞いを検証する。
 *
 * - マウント時に phase=output のタイマーが start される
 * - タイマー完了で本文が空ならエラーメッセージを表示する
 * - タイマー完了で本文があれば送信を促すメッセージを表示し、自動送信しない
 * - OutputEditor で本文を入力 → 送信すると submitOutput → break 画面へ replace する
 * - submitOutput が失敗するとエラーメッセージが表示され、再度送信できる
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

const submitSuccessResponse = {
  status: 'judging',
  output: {
    id: 'out-1',
    session_id: 'ses-123',
    content: '関係代名詞は先行詞を修飾する',
    submitted_at: '2026-04-10T15:25:00.000Z',
  },
} as const;

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

  it('タイマー完了で本文が空ならエラーメッセージを表示し、送信しない', async () => {
    const { getByTestId } = renderWithProviders(<OutputScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('output-editor-error')).toBeTruthy();
    });
    expect(sessionApi.submitOutput).not.toHaveBeenCalled();
  });

  it('タイマー完了で本文があれば送信を促すメッセージを表示し、自動送信しない', async () => {
    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.changeText(getByTestId('output-editor-textarea'), '関係代名詞は先行詞を修飾する');

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('output-editor-error')).toBeTruthy();
    });
    expect(sessionApi.submitOutput).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('本文入力 → 送信で submitOutput → break 画面へ replace する', async () => {
    (sessionApi.submitOutput as jest.Mock).mockResolvedValue(submitSuccessResponse);

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
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/break',
        params: { id: 'ses-123', break: '5' },
      });
    });
  });

  it('submitOutput 失敗時はエラーメッセージと「再送する」ボタンが現れ、明示操作で再送できる', async () => {
    (sessionApi.submitOutput as jest.Mock)
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockResolvedValueOnce(submitSuccessResponse);

    const { getByTestId } = renderWithProviders(<OutputScreen />);

    fireEvent.changeText(getByTestId('output-editor-textarea'), '本文');

    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });

    await waitFor(() => {
      expect(getByTestId('output-editor-error')).toBeTruthy();
    });

    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
      fireEvent.press(getByTestId('output-editor-submit'));
    });
    expect(sessionApi.submitOutput).toHaveBeenCalledTimes(1);

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

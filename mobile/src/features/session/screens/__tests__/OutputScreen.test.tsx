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
import { Keyboard, type KeyboardEvent, type KeyboardEventListener } from 'react-native';
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

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/features/session/api/sessionApi');

const keyboardListeners = new Map<string, KeyboardEventListener>();

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
    keyboardListeners.clear();
    jest.spyOn(Keyboard, 'addListener').mockImplementation((eventName, listener) => {
      keyboardListeners.set(eventName, listener);
      return {
        remove: () => {
          keyboardListeners.delete(eventName);
        },
      } as ReturnType<typeof Keyboard.addListener>;
    });
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
    // CI (Ubuntu) で runOnlyPendingTimers が RTL の auto cleanup と組み合わさると
    // 60s タイムアウトする事象が出ていたため、pending timer は捨ててから
    // real timers に戻す。
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('マウントで phase=output のタイマーが開始され、主要 UI が表示される', () => {
    const { getByTestId, getAllByText } = renderWithProviders(<OutputScreen />);
    // 画面タイトル・フェーズタブ・タイマー中央のラベルで複数回「アウトプット」が出現する
    expect(getAllByText('アウトプット').length).toBeGreaterThan(0);
    expect(getByTestId('output-settings-button')).toBeTruthy();
    expect(getByTestId('output-composer-card')).toBeTruthy();
    expect(useTimerStore.getState().phase).toBe('output');
    expect(useTimerStore.getState().totalSeconds).toBe(60);
  });

  it('キーボード表示時も全体レイアウトを維持しつつ入力欄が利用できる', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(<OutputScreen />);

    act(() => {
      keyboardListeners.get('keyboardWillShow')?.({
        duration: 250,
        endCoordinates: { height: 320, screenX: 0, screenY: 0, width: 0 },
        easing: 'keyboard',
        startCoordinates: { height: 0, screenX: 0, screenY: 0, width: 0 },
      } as KeyboardEvent);
    });

    expect(getByTestId('output-composer-card')).toBeTruthy();
    expect(getByTestId('output-editor-textarea')).toBeTruthy();
    expect(queryByTestId('output-settings-button')).toBeNull();
    expect(queryByTestId('output-hourglass-badge')).toBeNull();
    expect(queryByTestId('output-timer-caption')).toBeNull();
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

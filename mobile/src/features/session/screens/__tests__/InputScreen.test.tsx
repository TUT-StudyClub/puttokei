/**
 * InputScreen の振る舞いを検証する。
 *
 * マウント時にタイマーが start され、0 秒到達で status=output に PATCH → output 画面へ
 * replace 遷移することを fakeTimers + mock API で確認する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import { InputScreen } from '@/features/session/screens/InputScreen';
import { useTimerStore } from '@/shared/stores/timerStore';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({
    id: 'ses-123',
    input: '1',
    output: '5',
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

describe('InputScreen', () => {
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
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('マウント時にタイマーが start され、ヘッダーとタイマー表示がレンダリングされる', () => {
    const { getByText, getByTestId } = renderWithProviders(<InputScreen />);
    expect(getByText('インプット')).toBeTruthy();
    expect(getByTestId('timer-display')).toBeTruthy();
    expect(useTimerStore.getState().phase).toBe('input');
    expect(useTimerStore.getState().totalSeconds).toBe(60);
  });

  it('タイマー完了で PATCH status=output が送られ、output 画面へ replace する', async () => {
    (sessionApi.updateSessionStatus as jest.Mock).mockResolvedValue({
      id: 'ses-123',
      status: 'output',
    });

    renderWithProviders(<InputScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(sessionApi.updateSessionStatus).toHaveBeenCalledWith('ses-123', 'output');
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/output',
        params: { id: 'ses-123', output: '5', break: '5' },
      });
    });
  });
});

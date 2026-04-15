/**
 * BreakScreen の振る舞いを検証する。
 * タイマー完了で status=judged に PATCH → result 画面へ replace する（ダミー判定）。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import { BreakScreen } from '@/features/session/screens/BreakScreen';
import { useTimerStore } from '@/shared/stores/timerStore';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({
    id: 'ses-123',
    break: '1',
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

describe('BreakScreen', () => {
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

  it('マウントで phase=break のタイマーが開始され、タイトルが表示される', () => {
    const { getByText } = renderWithProviders(<BreakScreen />);
    expect(getByText('休憩')).toBeTruthy();
    expect(useTimerStore.getState().phase).toBe('break');
    expect(useTimerStore.getState().totalSeconds).toBe(60);
  });

  it('タイマー完了で PATCH status=judged が送られ、result 画面へ replace する', async () => {
    (sessionApi.updateSessionStatus as jest.Mock).mockResolvedValue({
      id: 'ses-123',
      status: 'judged',
    });

    renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(sessionApi.updateSessionStatus).toHaveBeenCalledWith('ses-123', 'judged');
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/result',
        params: { id: 'ses-123' },
      });
    });
  });
});

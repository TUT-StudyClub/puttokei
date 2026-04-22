/**
 * BreakScreen の振る舞いを検証する。
 * タイマー完了後に休憩完了画面を表示し、次サイクル準備画面へ進める。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import { BreakScreen } from '@/features/session/screens/BreakScreen';
import { useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => ({
    id: 'ses-123',
    input: '20',
    output: '5',
    break: '1',
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
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
    (sessionApi.getJudgment as jest.Mock).mockResolvedValue({
      kind: 'ready',
      judgment: {
        id: 'judgment-1',
        session_id: 'ses-123',
        verdict: 'correct',
        score: 92,
        advice: 'よくできています。',
        items: [],
        judged_at: '2026-04-10T15:25:00.000Z',
      },
    });
    useTimerStore.setState({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      completionToken: 0,
    });
    useLoopStore.getState().reset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // CI (Ubuntu) で RTL の auto cleanup (async) が 60s ハングしていたため、
    // fake timers が有効なうちに先回りで unmount を済ませる。
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('マウントで phase=break のタイマーが開始され、主要 UI が表示される', () => {
    const { getAllByText, getByTestId } = renderWithProviders(<BreakScreen />);
    // 画面タイトル / フェーズタブ / タイマー中央ラベルで複数回「休憩」が出現する
    expect(getAllByText('休憩').length).toBeGreaterThan(0);
    expect(getByTestId('break-settings-button')).toBeTruthy();
    expect(getByTestId('break-progress-card')).toBeTruthy();
    expect(useTimerStore.getState().phase).toBe('break');
    expect(useTimerStore.getState().totalSeconds).toBe(60);
  });

  it('タイマー完了で休憩完了画面を表示し、result へ自動遷移しない', async () => {
    const { getByTestId, getByText } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-completed-view')).toBeTruthy();
    });
    expect(getByText('お疲れ様でした！')).toBeTruthy();
    expect(getByText('記念すべき1サイクル目です！')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('「次のサイクルへ」押下で次サイクル準備画面を表示する', async () => {
    const { getByTestId, getByText } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-next-cycle-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('break-next-cycle-button'));

    expect(getByTestId('break-next-cycle-view')).toBeTruthy();
    expect(getByText('砂時計を回して次のサイクルを回そう！')).toBeTruthy();
    expect(getByTestId('break-next-cycle-cancel')).toBeTruthy();
  });

  it('次サイクル準備画面の砂時計押下で新しいセッションを作成し input へ遷移する', async () => {
    (sessionApi.createSession as jest.Mock).mockResolvedValue({
      id: 'ses-next',
      user_id: 'usr-1',
      status: 'input',
      subject: '未設定',
      topic: '未設定',
      input_minutes: 20,
      output_minutes: 5,
      break_minutes: 1,
      started_at: '2026-04-10T15:30:00.000Z',
      completed_at: null,
      created_at: '2026-04-10T15:30:00.000Z',
    });

    const { getByTestId } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-next-cycle-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('break-next-cycle-button'));
    fireEvent.press(getByTestId('break-next-cycle-hourglass'));

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalledWith({
        subject: '未設定',
        topic: '未設定',
        input_minutes: 20,
        output_minutes: 5,
        break_minutes: 1,
      });
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/session/[id]/input',
        params: {
          id: 'ses-next',
          input: '20',
          output: '5',
          break: '1',
        },
      });
    });
    expect(useLoopStore.getState().currentLoop).toBe(2);
  });

  it('次サイクル準備画面の中断ボタン押下でホームへ戻る', async () => {
    const { getByTestId } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-next-cycle-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('break-next-cycle-button'));
    fireEvent.press(getByTestId('break-next-cycle-cancel'));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});

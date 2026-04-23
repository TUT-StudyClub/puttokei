/**
 * InputScreen の振る舞いを検証する。
 *
 * マウント時にタイマーが start され、0 秒到達で status=output に PATCH → output 画面へ
 * replace 遷移することを fakeTimers + mock API で確認する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import { InputScreen } from '@/features/session/screens/InputScreen';
import { useTimerStore } from '@/shared/stores/timerStore';

const mockReplace = jest.fn();
let mockRouteParams = {
  id: 'ses-123',
  input: '1',
  output: '5',
  break: '5',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/features/session/api/sessionApi');

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <TamaguiProvider config={config} defaultTheme="light">
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </TamaguiProvider>
    );
  }

  return render(ui, { wrapper: Providers });
}

function resetRouteParams() {
  mockRouteParams = {
    id: 'ses-123',
    input: '1',
    output: '5',
    break: '5',
  };
}

describe('InputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRouteParams();
    (sessionApi.listTodayOutputs as jest.Mock).mockResolvedValue({ items: [] });
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
    // CI (Ubuntu) で RTL の auto cleanup (async) が 60s ハングしていたため、
    // fake timers が有効なうちに先回りで unmount を済ませる。
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('マウント時にタイマーが start され、フェーズ表記とタイマー表示がレンダリングされる', () => {
    const { getAllByText, getByTestId } = renderWithProviders(<InputScreen />);
    // フェーズタブと円中央の 2 箇所に「インプット」が表示される。
    expect(getAllByText('インプット').length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('timer-display')).toBeTruthy();
    expect(getByTestId('input-circular-timer')).toBeTruthy();
    expect(getByTestId('input-cancel-button')).toBeTruthy();
    expect(getByTestId('input-extend-button')).toBeTruthy();
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
        params: { id: 'ses-123', input: '1', output: '5', break: '5' },
      });
    });
  });

  it('session id が変わったら同じ画面インスタンスでも input タイマーを再開始する', () => {
    const { rerender } = renderWithProviders(<InputScreen />);

    expect(useTimerStore.getState().totalSeconds).toBe(60);

    act(() => {
      useTimerStore.getState().reset();
      mockRouteParams = {
        id: 'ses-next',
        input: '2',
        output: '5',
        break: '5',
      };
      rerender(<InputScreen />);
    });

    expect(useTimerStore.getState().phase).toBe('input');
    expect(useTimerStore.getState().status).toBe('running');
    expect(useTimerStore.getState().totalSeconds).toBe(120);
    expect(useTimerStore.getState().remainingSeconds).toBe(120);
  });

  it('今日のアウトプットを一覧表示し、選択すると詳細を表示する', async () => {
    (sessionApi.listTodayOutputs as jest.Mock).mockResolvedValue({
      items: [
        {
          session_id: 'ses-prev',
          output: {
            id: 'out-1',
            session_id: 'ses-prev',
            content: '明智光秀は本能寺の変で織田信長を討った',
            submitted_at: '2026-04-10T15:25:00.000Z',
          },
          cycle_index: 1,
          subject: '歴史',
          topic: '本能寺の変',
          judgment: {
            id: 'jdg-1',
            session_id: 'ses-prev',
            verdict: 'partial',
            score: 72,
            advice: '要点は押さえられています。',
            items: [{ label: '理解度', comment: '主題に沿って説明できています。' }],
            judged_at: '2026-04-10T15:30:00.000Z',
          },
        },
      ],
    });

    const { getByTestId, findByText } = renderWithProviders(<InputScreen />);

    expect(await findByText('今日のアウトプット')).toBeTruthy();
    fireEvent.press(getByTestId('today-output-row-out-1'));

    expect(getByTestId('output-review-detail')).toBeTruthy();
    expect(getByTestId('output-review-feedback')).toBeTruthy();
  });
});

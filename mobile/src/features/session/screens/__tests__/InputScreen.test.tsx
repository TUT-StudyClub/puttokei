/**
 * InputScreen の振る舞いを検証する。
 *
 * マウント時にタイマーが start され、0 秒到達で status=output に PATCH → output 画面へ
 * replace 遷移することを fakeTimers + mock API で確認する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Path, Rect } from 'react-native-svg';
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

  it('上部の砂時計は残り時間に応じて上が漏斗状に凹み、下が山型に積もる', () => {
    const { UNSAFE_getAllByType } = renderWithProviders(<InputScreen />);

    act(() => {
      useTimerStore.setState({
        totalSeconds: 60,
        remainingSeconds: 30,
        status: 'running',
      });
    });

    // 砂塊は Path（漏斗・山型）として描画される。
    const sandPaths = UNSAFE_getAllByType(Path).filter((path) => path.props.fill === '#4B5CFF');
    const upperSand = sandPaths.find(
      (path) => path.props.clipPath === 'url(#hourglassBadgeUpperSandClip)',
    );
    const lowerSand = sandPaths.find(
      (path) => path.props.clipPath === 'url(#hourglassBadgeLowerSandClip)',
    );

    expect(upperSand).toBeTruthy();
    expect(lowerSand).toBeTruthy();
    // 上部 path は中央に向けて凹む V 字を含む。残量 50% のとき凹み深さは 1.6（上限）
    expect(upperSand?.props.d).toContain('M3.3 8.93');
    expect(upperSand?.props.d).toContain('L8.85 10.53');
    // 下部 path は中央が高い山。lowerY = 22.065、山頂 = 22.065 - min(2.0, lowerHeight*0.4) = 20.065
    expect(lowerSand?.props.d).toContain('L8.85 20.065');

    // ストリームは雫型ではなく細い縦の筋（width 0.32）。
    const streamRect = UNSAFE_getAllByType(Rect).find(
      (rect) => rect.props.fill === '#4B5CFF' && rect.props.width === 0.32,
    );
    expect(streamRect).toBeTruthy();
    expect(streamRect?.props.height).toBe(5.6);
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
            content: '明智光秀は本能寺の変で死んだ',
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
            corrections: [
              {
                target_text: '明智光秀',
                correct_text: '織田信長は本能寺の変で死んだ',
                explanation: '本能寺の変で死亡したのは織田信長です。',
              },
            ],
            judged_at: '2026-04-10T15:30:00.000Z',
          },
        },
      ],
    });

    const { getByTestId, findByText, queryByTestId } = renderWithProviders(<InputScreen />);

    expect(await findByText('今日のアウトプット')).toBeTruthy();
    fireEvent.press(getByTestId('today-output-row-out-1'));

    expect(getByTestId('output-review-detail')).toBeTruthy();
    expect(getByTestId('output-review-annotated-text')).toBeTruthy();
    expect(getByTestId('output-review-feedback')).toBeTruthy();
    expect(queryByTestId('output-review-correction-popover')).toBeNull();

    // 赤ハイライトをタップすると正解 / 解説のポップオーバーが現れる
    fireEvent.press(getByTestId('correction-highlight-0'));
    expect(getByTestId('output-review-correction-popover')).toBeTruthy();
  });

  it('個別指摘がない判定でも advice を表示する', async () => {
    (sessionApi.listTodayOutputs as jest.Mock).mockResolvedValue({
      items: [
        {
          session_id: 'ses-prev',
          output: {
            id: 'out-2',
            session_id: 'ses-prev',
            content: '1+1=3',
            submitted_at: '2026-04-10T16:25:00.000Z',
          },
          cycle_index: 2,
          subject: '算数',
          topic: '足し算',
          judgment: {
            id: 'jdg-2',
            session_id: 'ses-prev',
            verdict: 'rejected',
            score: 0,
            advice: '学習内容をもう少し具体的に書いてください。',
            corrections: [],
            judged_at: '2026-04-10T16:30:00.000Z',
          },
        },
      ],
    });

    const { getByTestId, findByText } = renderWithProviders(<InputScreen />);

    expect(await findByText('今日のアウトプット')).toBeTruthy();
    fireEvent.press(getByTestId('today-output-row-out-2'));

    expect(getByTestId('output-review-feedback')).toBeTruthy();
    expect(getByTestId('output-review-annotated-text')).toBeTruthy();
    expect(await findByText('学習内容をもう少し具体的に書いてください。')).toBeTruthy();
    expect(await findByText('今回の判定では、個別に直す箇所はありませんでした。')).toBeTruthy();
  });
});

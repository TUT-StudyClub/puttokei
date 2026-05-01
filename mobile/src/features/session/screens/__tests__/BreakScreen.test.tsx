/**
 * BreakScreen の振る舞いを検証する。
 * タイマー完了後に休憩完了画面を表示し、次サイクル準備画面へ進める。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Path, Rect } from 'react-native-svg';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as sessionApi from '@/features/session/api/sessionApi';
import * as useJudgmentProgressHook from '@/features/session/hooks/useJudgmentProgress';
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
jest.mock('@/features/session/hooks/useJudgmentProgress');

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

function rotationResponderEvent(
  locationX: number,
  locationY: number,
  previousLocationX = locationX,
  previousLocationY = locationY,
  timestamp = 1,
) {
  return {
    nativeEvent: { locationX, locationY },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: timestamp,
      touchBank: [
        {
          touchActive: true,
          currentPageX: locationX,
          currentPageY: locationY,
          previousPageX: previousLocationX,
          previousPageY: previousLocationY,
          currentTimeStamp: timestamp,
          previousTimeStamp: timestamp - 1,
        },
      ],
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('BreakScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useJudgmentProgressHook.useJudgmentProgress as jest.Mock).mockReturnValue({
      data: {
        status: 'running',
        stage: 'requesting_llm',
        percent: 42,
        message: 'AI に判定を依頼しています。',
        updated_at: '2026-04-10T15:24:30.000Z',
        completed_at: null,
        error_code: null,
      },
      isPollingFallback: false,
    });
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
    const { getAllByText, getByTestId, queryByLabelText, queryByTestId } =
      renderWithProviders(<BreakScreen />);
    // 画面タイトル / フェーズタブ / タイマー中央ラベルで複数回「休憩」が出現する
    expect(getAllByText('休憩').length).toBeGreaterThan(0);
    expect(queryByTestId('break-settings-button')).toBeNull();
    expect(queryByLabelText('設定')).toBeNull();
    expect(getByTestId('break-progress-card')).toBeTruthy();
    expect(useTimerStore.getState().phase).toBe('break');
    expect(useTimerStore.getState().totalSeconds).toBe(60);
  });

  it('判定進捗カードに progress API の status / message / percent を表示する', async () => {
    (sessionApi.getJudgment as jest.Mock).mockResolvedValue({
      kind: 'pending',
      pending: {
        status: 'pending',
        detail: '判定結果を準備しています。',
        retry_after_seconds: 5,
        estimated_ready_at: '2026-04-10T15:30:00.000Z',
      },
    });

    const { getByTestId, getByText } = renderWithProviders(<BreakScreen />);

    await waitFor(() => {
      expect(getByTestId('break-progress-status')).toBeTruthy();
    });
    expect(getByTestId('break-progress-status').props.children).toBe('採点中');
    expect(getByTestId('break-progress-message').props.children).toBe(
      'AI に判定を依頼しています。',
    );
    expect(getByText('42%')).toBeTruthy();
  });

  it('useJudgment が ready のときは進捗を 100% で表示する', async () => {
    const { getByTestId, getByText } = renderWithProviders(<BreakScreen />);

    await waitFor(() => {
      expect(getByTestId('break-progress-ready')).toBeTruthy();
    });
    expect(getByText('100%')).toBeTruthy();
    expect(getByTestId('break-progress-status').props.children).toBe('採点完了');
  });

  it('休憩中の砂時計は上部が白のみ・下部に青/ピンク/白が積もり、ストリームは白色', () => {
    const { UNSAFE_getAllByType } = renderWithProviders(<BreakScreen />);

    // route params は input='20', output='5', break='1' (合計 26 分)。break 50% 経過。
    act(() => {
      useTimerStore.setState({
        totalSeconds: 60,
        remainingSeconds: 30,
        status: 'running',
      });
    });

    const upperClip = 'url(#hourglassBadgeBlueUpperSandClip)';
    const lowerClip = 'url(#hourglassBadgeBlueLowerSandClip)';

    const upperPaths = UNSAFE_getAllByType(Path).filter(
      (path) => path.props.clipPath === upperClip,
    );
    // 上部は白 (break) のみ。input/output は progress=0 なので上部に出ない。
    const whiteUpper = upperPaths.find((path) => path.props.fill === '#FFFFFF');
    expect(whiteUpper).toBeTruthy();
    expect(whiteUpper?.props.fillOpacity).toBe(0.92);
    expect(upperPaths.find((path) => path.props.fill === '#148BFF')).toBeUndefined();
    expect(upperPaths.find((path) => path.props.fill === '#F24D7E')).toBeUndefined();

    // 下部には input(青) / output(ピンク) / break(白) の 3 色が積もる。
    const lowerPaths = UNSAFE_getAllByType(Path).filter(
      (path) => path.props.clipPath === lowerClip,
    );
    expect(lowerPaths.find((path) => path.props.fill === '#148BFF')).toBeTruthy();
    expect(lowerPaths.find((path) => path.props.fill === '#F24D7E')).toBeTruthy();
    expect(lowerPaths.find((path) => path.props.fill === '#FFFFFF')).toBeTruthy();

    // ストリームは active = 白。blue variant の width=0.43 / height=7.41 で同定する。
    const streamRect = UNSAFE_getAllByType(Rect).find(
      (rect) => rect.props.fill === '#FFFFFF' && rect.props.width === 0.43,
    );
    expect(streamRect).toBeTruthy();
    expect(streamRect?.props.height).toBe(7.41);
  });

  it('休憩終了直後 (remaining=0) は上部に砂が無く、下部に青/ピンク/白が積もる', () => {
    const { UNSAFE_getAllByType } = renderWithProviders(<BreakScreen />);

    act(() => {
      useTimerStore.setState({
        totalSeconds: 60,
        remainingSeconds: 0,
        status: 'running',
      });
    });

    const upperClip = 'url(#hourglassBadgeBlueUpperSandClip)';
    const lowerClip = 'url(#hourglassBadgeBlueLowerSandClip)';

    const upperPaths = UNSAFE_getAllByType(Path).filter(
      (path) => path.props.clipPath === upperClip,
    );
    expect(upperPaths).toHaveLength(0);

    const lowerPaths = UNSAFE_getAllByType(Path).filter(
      (path) => path.props.clipPath === lowerClip,
    );
    expect(lowerPaths.find((path) => path.props.fill === '#148BFF')).toBeTruthy();
    expect(lowerPaths.find((path) => path.props.fill === '#F24D7E')).toBeTruthy();
    expect(lowerPaths.find((path) => path.props.fill === '#FFFFFF')).toBeTruthy();
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
    expect(useLoopStore.getState().currentLoop).toBe(1);
  });

  it('次サイクル準備画面の砂時計を回転させ、セッション作成成功後にだけループを進める', async () => {
    const nextSession = {
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
    };
    const createSessionDeferred = createDeferred<typeof nextSession>();
    (sessionApi.createSession as jest.Mock).mockReturnValue(createSessionDeferred.promise);

    const { getByTestId } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-next-cycle-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('break-next-cycle-button'));
    fireEvent.press(getByTestId('break-next-cycle-hourglass'));
    expect(sessionApi.createSession).not.toHaveBeenCalled();

    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderGrant',
      rotationResponderEvent(260, 215),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(160, 115, 260, 215, 2),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(60, 215, 160, 115, 3),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(160, 315, 60, 215, 4),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(260, 215, 160, 315, 5),
    );

    expect(sessionApi.createSession).not.toHaveBeenCalled();

    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderRelease',
      rotationResponderEvent(260, 215, 260, 215, 6),
    );

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalledWith({
        subject: '未設定',
        topic: '未設定',
        input_minutes: 20,
        output_minutes: 5,
        break_minutes: 1,
      });
    });
    expect(useLoopStore.getState().currentLoop).toBe(1);
    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => {
      createSessionDeferred.resolve(nextSession);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/session/[id]/input',
        params: {
          id: 'ses-next',
          input: '20',
          output: '5',
          break: '1',
        },
      });
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(useLoopStore.getState().currentLoop).toBe(2);
  });

  it('次サイクル準備画面で一周未満の回転では指を離しても開始しない', async () => {
    const { getByTestId } = renderWithProviders(<BreakScreen />);

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    await waitFor(() => {
      expect(getByTestId('break-next-cycle-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('break-next-cycle-button'));

    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderGrant',
      rotationResponderEvent(260, 215),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(160, 115, 260, 215, 2),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderMove',
      rotationResponderEvent(60, 215, 160, 115, 3),
    );
    fireEvent(
      getByTestId('break-next-cycle-rotation-area'),
      'responderRelease',
      rotationResponderEvent(60, 215, 60, 215, 4),
    );

    expect(sessionApi.createSession).not.toHaveBeenCalled();
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

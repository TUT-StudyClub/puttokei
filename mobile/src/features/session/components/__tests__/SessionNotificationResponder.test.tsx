/**
 * SessionNotificationResponder の挙動を検証する。
 * - kind: 'input' → /session/[id]/output に replace（done なし）+ status を output に PATCH
 *   + timerStore は reset (output タイマーは画面側で start する)
 * - kind: 'output' → /session/[id]/output に replace（done=1）+ timerStore は complete
 * - kind: 'break' → /session/[id]/break に replace（done=1）
 * - 同じ identifier の通知は 2 度処理しない
 */
import { render } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import * as sessionApi from '@/features/session/api/sessionApi';
import { SessionNotificationResponder } from '@/features/session/components/SessionNotificationResponder';
import { useTimerStore } from '@/shared/stores/timerStore';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/features/session/api/sessionApi', () => ({
  updateSessionStatus: jest.fn().mockResolvedValue(undefined),
}));

const useLastNotificationResponseMock =
  Notifications.useLastNotificationResponse as unknown as jest.Mock;

function buildResponse(
  identifier: string,
  data: Record<string, unknown>,
): Notifications.NotificationResponse {
  return {
    actionIdentifier: 'default',
    notification: {
      date: 0,
      request: {
        identifier,
        content: {
          title: 't',
          body: 'b',
          data,
          subtitle: null,
          sound: null,
          launchImageName: null,
          badge: null,
          attachments: [],
        },
        trigger: null as unknown as Notifications.NotificationTrigger,
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

describe('SessionNotificationResponder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLastNotificationResponseMock.mockReturnValue(null);
  });

  it('kind=input をタップすると status を output に更新し、output 画面へ done なしで replace し、timerStore を reset する', () => {
    // background で残った input フェーズの中途半端な状態を再現
    useTimerStore.setState({
      phase: 'input',
      status: 'running',
      totalSeconds: 1500,
      remainingSeconds: 120,
      completionToken: 0,
    });
    useLastNotificationResponseMock.mockReturnValue(
      buildResponse('n-1', {
        kind: 'input',
        sessionId: 'sess-1',
        inputMinutes: '20',
        outputMinutes: '5',
        breakMinutes: '5',
      }),
    );

    render(<SessionNotificationResponder />);

    expect(sessionApi.updateSessionStatus).toHaveBeenCalledWith('sess-1', 'output');
    // done=1 を渡さないことで OutputScreen が start('output', outputMinutes * 60) で
    // 通常通り output タイマーを開始する経路に入る。
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/session/[id]/output',
      params: { id: 'sess-1', input: '20', output: '5', break: '5' },
    });
    // input フェーズの残骸はクリアされている (idle 状態)。
    const state = useTimerStore.getState();
    expect(state.phase).toBe('idle');
    expect(state.status).toBe('idle');
    expect(state.remainingSeconds).toBe(0);
  });

  it('kind=output をタップすると output 画面へ done=1 で戻し、status PATCH は呼ばない', () => {
    useLastNotificationResponseMock.mockReturnValue(
      buildResponse('n-2', {
        kind: 'output',
        sessionId: 'sess-2',
        inputMinutes: '20',
        outputMinutes: '5',
        breakMinutes: '5',
      }),
    );

    render(<SessionNotificationResponder />);

    expect(sessionApi.updateSessionStatus).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/session/[id]/output',
      params: { id: 'sess-2', input: '20', output: '5', break: '5', done: '1' },
    });
  });

  it('通知タップで timerStore.complete() を呼び、中途半端な秒数からの再開を防ぐ', () => {
    // タイマーを running 状態（残 30 秒）にしておく
    useTimerStore.setState({
      phase: 'output',
      status: 'running',
      totalSeconds: 300,
      remainingSeconds: 30,
      completionToken: 0,
    });
    useLastNotificationResponseMock.mockReturnValue(
      buildResponse('n-jump', {
        kind: 'output',
        sessionId: 'sess-jump',
        inputMinutes: '20',
        outputMinutes: '5',
        breakMinutes: '5',
      }),
    );

    render(<SessionNotificationResponder />);

    const state = useTimerStore.getState();
    expect(state.status).toBe('completed');
    expect(state.remainingSeconds).toBe(0);
  });

  it('kind=break をタップすると break 画面に done=1 で replace（completed モード）', () => {
    useLastNotificationResponseMock.mockReturnValue(
      buildResponse('n-3', {
        kind: 'break',
        sessionId: 'sess-3',
        inputMinutes: '20',
        outputMinutes: '5',
        breakMinutes: '5',
      }),
    );

    render(<SessionNotificationResponder />);

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/session/[id]/break',
      params: { id: 'sess-3', input: '20', output: '5', break: '5', done: '1' },
    });
  });

  it('同じ identifier の通知は 2 度処理しない', () => {
    const response = buildResponse('n-4', {
      kind: 'input',
      sessionId: 'sess-4',
      inputMinutes: '20',
      outputMinutes: '5',
      breakMinutes: '5',
    });
    useLastNotificationResponseMock.mockReturnValue(response);

    const { rerender } = render(<SessionNotificationResponder />);
    rerender(<SessionNotificationResponder />);

    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('data に kind が無い場合は何もしない', () => {
    useLastNotificationResponseMock.mockReturnValue(buildResponse('n-5', { sessionId: 'sess-5' }));

    render(<SessionNotificationResponder />);

    expect(mockReplace).not.toHaveBeenCalled();
  });
});

/**
 * useScheduleSessionPhaseNotification の振る舞いを検証する。
 * - enabled の立ち上がりで scheduleSessionPhaseNotification を呼ぶ
 * - 通知 data に乗せる route 情報（sessionId / minutes）が渡る
 * - unmount / enabled=false で予約をキャンセルする
 * - remainingSeconds=0 のときは何もしない
 */
import { cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { useScheduleSessionPhaseNotification } from '@/features/session/hooks/useScheduleSessionPhaseNotification';
import * as notifications from '@/shared/lib/notifications';
import { useTimerStore } from '@/shared/stores/timerStore';

jest.mock('@/shared/lib/notifications', () => ({
  scheduleSessionPhaseNotification: jest.fn(),
  cancelScheduledNotification: jest.fn().mockResolvedValue(undefined),
}));

const scheduleMock = notifications.scheduleSessionPhaseNotification as jest.Mock;
const cancelMock = notifications.cancelScheduledNotification as jest.Mock;

const defaultRoute = {
  sessionId: 'sess-1',
  inputMinutes: 20,
  outputMinutes: 5,
  breakMinutes: 5,
};

describe('useScheduleSessionPhaseNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTimerStore.setState({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      completionToken: 0,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('enabled=true で残秒数 > 0 のときに scheduleSessionPhaseNotification を呼ぶ', async () => {
    useTimerStore.setState({ remainingSeconds: 1200 });
    scheduleMock.mockResolvedValue('id-1');

    renderHook(() =>
      useScheduleSessionPhaseNotification({ kind: 'input', enabled: true, ...defaultRoute }),
    );

    await waitFor(() => {
      expect(scheduleMock).toHaveBeenCalledWith('input', defaultRoute, 1200);
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('enabled=false では予約しない', () => {
    useTimerStore.setState({ remainingSeconds: 1200 });

    renderHook(() =>
      useScheduleSessionPhaseNotification({ kind: 'input', enabled: false, ...defaultRoute }),
    );

    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('sessionId が空文字のときは予約しない', () => {
    useTimerStore.setState({ remainingSeconds: 1200 });

    renderHook(() =>
      useScheduleSessionPhaseNotification({
        kind: 'input',
        enabled: true,
        sessionId: '',
        inputMinutes: 20,
        outputMinutes: 5,
        breakMinutes: 5,
      }),
    );

    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('残秒数が 0 のときは予約しない', () => {
    useTimerStore.setState({ remainingSeconds: 0 });

    renderHook(() =>
      useScheduleSessionPhaseNotification({ kind: 'input', enabled: true, ...defaultRoute }),
    );

    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('unmount 時に予約をキャンセルする', async () => {
    useTimerStore.setState({ remainingSeconds: 600 });
    scheduleMock.mockResolvedValue('id-2');

    const { unmount } = renderHook(() =>
      useScheduleSessionPhaseNotification({ kind: 'output', enabled: true, ...defaultRoute }),
    );

    await waitFor(() => {
      expect(scheduleMock).toHaveBeenCalledTimes(1);
    });
    unmount();
    await waitFor(() => {
      expect(cancelMock).toHaveBeenCalledWith('id-2');
    });
  });

  it('enabled が true→false に変わったら予約をキャンセルする', async () => {
    useTimerStore.setState({ remainingSeconds: 600 });
    scheduleMock.mockResolvedValue('id-3');

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useScheduleSessionPhaseNotification({ kind: 'break', enabled, ...defaultRoute }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(scheduleMock).toHaveBeenCalledTimes(1);
    });
    rerender({ enabled: false });
    await waitFor(() => {
      expect(cancelMock).toHaveBeenCalledWith('id-3');
    });
  });
});

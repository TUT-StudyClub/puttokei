/**
 * `useTimer` の挙動を fakeTimers ベースで検証する。
 * - interval 駆動での remainingSeconds 減少
 * - pause / resume
 * - 完了時の onComplete が冪等に 1 度だけ呼ばれる
 * - unmount 時の cleanup
 * - onComplete の差し替えが反映される (ref 経由)
 */
import { act, cleanup, renderHook } from '@testing-library/react-native';

import { formatMmSs, useTimer } from '../useTimer';
import { useTimerStore } from '@/shared/stores/timerStore';

describe('formatMmSs', () => {
  it.each([
    [0, '00:00'],
    [9, '00:09'],
    [59, '00:59'],
    [60, '01:00'],
    [65, '01:05'],
    [1200, '20:00'],
    [3661, '61:01'],
    [-5, '00:00'],
  ])('%i 秒は "%s" にフォーマットされる', (input, expected) => {
    expect(formatMmSs(input)).toBe(expected);
  });
});

describe('useTimer', () => {
  beforeEach(() => {
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
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('start 後に時間経過で remainingSeconds が減り、formatted も更新される', () => {
    const { result } = renderHook(() => useTimer());
    act(() => {
      result.current.start('input', 5);
    });
    expect(result.current.remainingSeconds).toBe(5);
    expect(result.current.formatted).toBe('00:05');

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.remainingSeconds).toBe(2);
    expect(result.current.formatted).toBe('00:02');
  });

  it('pause 中は時間経過で減らず、resume 後に再開する', () => {
    const { result } = renderHook(() => useTimer());
    act(() => {
      result.current.start('input', 10);
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSeconds).toBe(8);

    act(() => {
      result.current.pause();
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.remainingSeconds).toBe(8);

    act(() => {
      result.current.resume();
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSeconds).toBe(6);
  });

  it('0 秒到達で onComplete が phase 付きで 1 度だけ呼ばれる', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useTimer({ onComplete }));
    act(() => {
      result.current.start('input', 2);
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('input');

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('unmount で interval が解除され、その後は store の値が進まない', () => {
    const { result, unmount } = renderHook(() => useTimer());
    act(() => {
      result.current.start('input', 10);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(useTimerStore.getState().remainingSeconds).toBe(9);

    unmount();
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(useTimerStore.getState().remainingSeconds).toBe(9);
  });

  it('onComplete を差し替えると最新のコールバックが呼ばれる', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = renderHook(
      ({ cb }: { cb: (phase: 'idle' | 'input' | 'output' | 'break') => void }) =>
        useTimer({ onComplete: cb }),
      { initialProps: { cb: first } },
    );
    act(() => {
      result.current.start('input', 2);
    });
    rerender({ cb: second });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('input');
  });

  it('complete() を呼ぶと onComplete が発火し remainingSeconds が 0 になる', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useTimer({ onComplete }));
    act(() => {
      result.current.start('output', 30);
    });
    act(() => {
      result.current.complete();
    });
    expect(result.current.status).toBe('completed');
    expect(result.current.remainingSeconds).toBe(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('output');
  });

  it('enabled=false の間は tick も onComplete も止まる', () => {
    const onComplete = jest.fn();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useTimer({ enabled, onComplete }),
      { initialProps: { enabled: false } },
    );

    act(() => {
      result.current.start('input', 3);
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.remainingSeconds).toBe(3);
    expect(onComplete).not.toHaveBeenCalled();

    rerender({ enabled: true });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(2);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('enabled=false 中に進んだ completionToken は、再度 enabled=true になっても遅延発火しない', () => {
    const onComplete = jest.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useTimer({ enabled, onComplete }),
      { initialProps: { enabled: false } },
    );

    act(() => {
      useTimerStore.setState({
        phase: 'output',
        status: 'completed',
        totalSeconds: 60,
        remainingSeconds: 0,
        completionToken: 1,
      });
    });

    rerender({ enabled: true });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('reset で idle に戻り、再度 start して完了すると onComplete が再発火する', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useTimer({ onComplete }));
    act(() => {
      result.current.start('input', 1);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');

    act(() => {
      result.current.start('break', 1);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenLastCalledWith('break');
  });
});

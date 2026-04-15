/**
 * `timerStore` を pure な状態機械としてテストする。React / Provider に依存せず、
 * `getState()` / `setState()` を直接使って各アクションの遷移を検証する。
 */
import { useTimerStore } from '../timerStore';

describe('timerStore', () => {
  beforeEach(() => {
    useTimerStore.setState({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      completionToken: 0,
    });
  });

  it('初期状態は idle / 0 秒', () => {
    const s = useTimerStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.status).toBe('idle');
    expect(s.totalSeconds).toBe(0);
    expect(s.remainingSeconds).toBe(0);
    expect(s.completionToken).toBe(0);
  });

  it('start で指定 phase / seconds の running 状態に遷移する', () => {
    useTimerStore.getState().start('input', 1200);
    const s = useTimerStore.getState();
    expect(s.phase).toBe('input');
    expect(s.status).toBe('running');
    expect(s.totalSeconds).toBe(1200);
    expect(s.remainingSeconds).toBe(1200);
  });

  it('start(phase, 0) は即 completed になり completionToken を +1 する', () => {
    const before = useTimerStore.getState().completionToken;
    useTimerStore.getState().start('input', 0);
    const s = useTimerStore.getState();
    expect(s.status).toBe('completed');
    expect(s.remainingSeconds).toBe(0);
    expect(s.completionToken).toBe(before + 1);
  });

  it('start は負数や小数の seconds を 0 以上の整数に丸める', () => {
    useTimerStore.getState().start('input', 12.9);
    expect(useTimerStore.getState().remainingSeconds).toBe(12);
    useTimerStore.getState().start('input', -5);
    // 負数は 0 扱いなので即 completed
    expect(useTimerStore.getState().status).toBe('completed');
  });

  it('pause は running からのみ有効', () => {
    useTimerStore.getState().pause();
    expect(useTimerStore.getState().status).toBe('idle');

    useTimerStore.getState().start('input', 10);
    useTimerStore.getState().pause();
    expect(useTimerStore.getState().status).toBe('paused');
  });

  it('resume は paused からのみ有効', () => {
    useTimerStore.getState().resume();
    expect(useTimerStore.getState().status).toBe('idle');

    useTimerStore.getState().start('input', 10);
    useTimerStore.getState().resume();
    // 既に running なので変化なし
    expect(useTimerStore.getState().status).toBe('running');

    useTimerStore.getState().pause();
    useTimerStore.getState().resume();
    expect(useTimerStore.getState().status).toBe('running');
  });

  it('tick を N 回呼ぶと remainingSeconds が N 減る', () => {
    useTimerStore.getState().start('input', 5);
    useTimerStore.getState().tick();
    useTimerStore.getState().tick();
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().remainingSeconds).toBe(2);
    expect(useTimerStore.getState().status).toBe('running');
  });

  it('paused / idle / completed 中の tick は no-op', () => {
    useTimerStore.getState().start('input', 5);
    useTimerStore.getState().pause();
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().remainingSeconds).toBe(5);

    useTimerStore.getState().reset();
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().remainingSeconds).toBe(0);
  });

  it('残り 1 秒で tick すると completed へ遷移し completionToken が +1 される', () => {
    useTimerStore.getState().start('input', 1);
    const before = useTimerStore.getState().completionToken;
    useTimerStore.getState().tick();
    const s = useTimerStore.getState();
    expect(s.status).toBe('completed');
    expect(s.remainingSeconds).toBe(0);
    expect(s.completionToken).toBe(before + 1);
  });

  it('complete を 2 回連続で呼んでも completionToken は 1 回しか増えない', () => {
    useTimerStore.getState().start('input', 10);
    const before = useTimerStore.getState().completionToken;
    useTimerStore.getState().complete();
    useTimerStore.getState().complete();
    expect(useTimerStore.getState().completionToken).toBe(before + 1);
    expect(useTimerStore.getState().status).toBe('completed');
  });

  it('reset は idle に戻すが completionToken は保持する', () => {
    useTimerStore.getState().start('input', 1);
    useTimerStore.getState().tick(); // completed, token +1
    const tokenAfterComplete = useTimerStore.getState().completionToken;
    useTimerStore.getState().reset();
    const s = useTimerStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.status).toBe('idle');
    expect(s.totalSeconds).toBe(0);
    expect(s.remainingSeconds).toBe(0);
    expect(s.completionToken).toBe(tokenAfterComplete);
  });

  it('reset 後に再度フェーズを完走すると completionToken がさらに +1 される', () => {
    useTimerStore.getState().start('input', 1);
    useTimerStore.getState().tick();
    const first = useTimerStore.getState().completionToken;
    useTimerStore.getState().reset();
    useTimerStore.getState().start('output', 1);
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().completionToken).toBe(first + 1);
    expect(useTimerStore.getState().phase).toBe('output');
  });
});

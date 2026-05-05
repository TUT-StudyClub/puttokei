/**
 * `timerStore` を pure な状態機械としてテストする。React / Provider に依存せず、
 * `getState()` / `setState()` を直接使って各アクションの遷移を検証する。
 *
 * `Date.now()` アンカー方式に切り替わったため、時刻は `jest.useFakeTimers` の
 * `setSystemTime` で制御する。`jest.advanceTimersByTime` でも実時計が進む。
 */
import { useTimerStore } from '../timerStore';

const INITIAL_STATE = {
  phase: 'idle' as const,
  status: 'idle' as const,
  totalSeconds: 0,
  remainingSeconds: 0,
  completionToken: 0,
  startedAtMs: null,
  baseRemainingSeconds: 0,
};

describe('timerStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    useTimerStore.setState(INITIAL_STATE);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('初期状態は idle / 0 秒', () => {
    const s = useTimerStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.status).toBe('idle');
    expect(s.totalSeconds).toBe(0);
    expect(s.remainingSeconds).toBe(0);
    expect(s.completionToken).toBe(0);
    expect(s.startedAtMs).toBeNull();
    expect(s.baseRemainingSeconds).toBe(0);
  });

  it('start で指定 phase / seconds の running 状態に遷移し、Date.now のアンカーを記録する', () => {
    const before = Date.now();
    useTimerStore.getState().start('input', 1200);
    const s = useTimerStore.getState();
    expect(s.phase).toBe('input');
    expect(s.status).toBe('running');
    expect(s.totalSeconds).toBe(1200);
    expect(s.remainingSeconds).toBe(1200);
    expect(s.startedAtMs).toBe(before);
    expect(s.baseRemainingSeconds).toBe(1200);
  });

  it('start(phase, 0) は即 completed になり completionToken を +1、anchor は null', () => {
    const before = useTimerStore.getState().completionToken;
    useTimerStore.getState().start('input', 0);
    const s = useTimerStore.getState();
    expect(s.status).toBe('completed');
    expect(s.remainingSeconds).toBe(0);
    expect(s.completionToken).toBe(before + 1);
    expect(s.startedAtMs).toBeNull();
    expect(s.baseRemainingSeconds).toBe(0);
  });

  it('start は負数や小数の seconds を 0 以上の整数に丸める', () => {
    useTimerStore.getState().start('input', 12.9);
    expect(useTimerStore.getState().remainingSeconds).toBe(12);
    useTimerStore.getState().start('input', -5);
    // 負数は 0 扱いなので即 completed
    expect(useTimerStore.getState().status).toBe('completed');
  });

  it('pause は running からのみ有効。経過秒を引いた値を確定する', () => {
    useTimerStore.getState().pause();
    expect(useTimerStore.getState().status).toBe('idle');

    useTimerStore.getState().start('input', 60);
    jest.advanceTimersByTime(15_000);
    useTimerStore.getState().pause();
    const s = useTimerStore.getState();
    expect(s.status).toBe('paused');
    expect(s.remainingSeconds).toBe(45);
    expect(s.baseRemainingSeconds).toBe(45);
    expect(s.startedAtMs).toBeNull();
  });

  it('resume は paused からのみ有効。新しい anchor で再開する', () => {
    useTimerStore.getState().resume();
    expect(useTimerStore.getState().status).toBe('idle');

    useTimerStore.getState().start('input', 60);
    useTimerStore.getState().resume();
    // 既に running なので変化なし
    expect(useTimerStore.getState().status).toBe('running');

    jest.advanceTimersByTime(20_000);
    useTimerStore.getState().pause();
    expect(useTimerStore.getState().remainingSeconds).toBe(40);

    jest.advanceTimersByTime(60_000);
    const beforeResume = Date.now();
    useTimerStore.getState().resume();
    const s = useTimerStore.getState();
    expect(s.status).toBe('running');
    // pause 中は時間経過しない
    expect(s.remainingSeconds).toBe(40);
    expect(s.baseRemainingSeconds).toBe(40);
    expect(s.startedAtMs).toBe(beforeResume);
  });

  it('recomputeRemaining は running 中に Date.now の経過秒を反映する', () => {
    useTimerStore.getState().start('input', 10);
    jest.advanceTimersByTime(3_000);
    useTimerStore.getState().recomputeRemaining();
    expect(useTimerStore.getState().remainingSeconds).toBe(7);
    expect(useTimerStore.getState().status).toBe('running');
  });

  it('paused / idle / completed 中の recomputeRemaining は no-op', () => {
    useTimerStore.getState().start('input', 5);
    useTimerStore.getState().pause();
    jest.advanceTimersByTime(10_000);
    useTimerStore.getState().recomputeRemaining();
    expect(useTimerStore.getState().remainingSeconds).toBe(5);

    useTimerStore.getState().reset();
    useTimerStore.getState().recomputeRemaining();
    expect(useTimerStore.getState().remainingSeconds).toBe(0);
  });

  it('background 相当の時間ジャンプ後に recomputeRemaining すると一気に実時間ぶん進む', () => {
    useTimerStore.getState().start('input', 1500);
    // 25 分中、20 分間 background で経過したと仮定
    jest.advanceTimersByTime(20 * 60_000);
    useTimerStore.getState().recomputeRemaining();
    expect(useTimerStore.getState().remainingSeconds).toBe(5 * 60);
    expect(useTimerStore.getState().status).toBe('running');
  });

  it('残り 1 秒以上の経過時間で recomputeRemaining すると completed へ遷移し completionToken が +1 される', () => {
    useTimerStore.getState().start('input', 5);
    const before = useTimerStore.getState().completionToken;
    jest.advanceTimersByTime(5_000);
    useTimerStore.getState().recomputeRemaining();
    const s = useTimerStore.getState();
    expect(s.status).toBe('completed');
    expect(s.remainingSeconds).toBe(0);
    expect(s.completionToken).toBe(before + 1);
    expect(s.startedAtMs).toBeNull();
  });

  it('background で残時間を超過したケースでも 0 にクランプして completed になる', () => {
    useTimerStore.getState().start('input', 30);
    // 30 秒タイマーに対して 5 分後に復帰
    jest.advanceTimersByTime(5 * 60_000);
    useTimerStore.getState().recomputeRemaining();
    const s = useTimerStore.getState();
    expect(s.status).toBe('completed');
    expect(s.remainingSeconds).toBe(0);
  });

  it('complete を 2 回連続で呼んでも completionToken は 1 回しか増えない', () => {
    useTimerStore.getState().start('input', 10);
    const before = useTimerStore.getState().completionToken;
    useTimerStore.getState().complete();
    useTimerStore.getState().complete();
    expect(useTimerStore.getState().completionToken).toBe(before + 1);
    expect(useTimerStore.getState().status).toBe('completed');
  });

  it('extend は running の残り秒数と合計秒数に加算し、anchor をリセットする', () => {
    useTimerStore.getState().start('input', 60);
    jest.advanceTimersByTime(10_000);
    const beforeExtend = Date.now();
    useTimerStore.getState().extend(30);
    let s = useTimerStore.getState();
    // running 中の extend は recompute → 加算 ではなく、最後の remainingSeconds に
    // 加算する形で実装している。タイマーの基準が一旦 reset されるため、anchor は
    // extend 時点。base は 60 + 30 = 90 ではなく、未 recompute の 60 + 30 = 90。
    expect(s.remainingSeconds).toBe(90);
    expect(s.totalSeconds).toBe(90);
    expect(s.baseRemainingSeconds).toBe(90);
    expect(s.startedAtMs).toBe(beforeExtend);

    useTimerStore.getState().pause();
    useTimerStore.getState().extend(15);
    s = useTimerStore.getState();
    expect(s.totalSeconds).toBe(105);
    expect(s.startedAtMs).toBeNull();
  });

  it('extend は idle / completed では no-op', () => {
    // idle
    useTimerStore.getState().extend(30);
    expect(useTimerStore.getState().remainingSeconds).toBe(0);
    expect(useTimerStore.getState().totalSeconds).toBe(0);

    // completed
    useTimerStore.getState().start('input', 1);
    jest.advanceTimersByTime(1_000);
    useTimerStore.getState().recomputeRemaining();
    const totalBefore = useTimerStore.getState().totalSeconds;
    useTimerStore.getState().extend(30);
    expect(useTimerStore.getState().remainingSeconds).toBe(0);
    expect(useTimerStore.getState().totalSeconds).toBe(totalBefore);
  });

  it('reset は idle に戻すが completionToken は保持する', () => {
    useTimerStore.getState().start('input', 1);
    jest.advanceTimersByTime(1_000);
    useTimerStore.getState().recomputeRemaining();
    const tokenAfterComplete = useTimerStore.getState().completionToken;
    useTimerStore.getState().reset();
    const s = useTimerStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.status).toBe('idle');
    expect(s.totalSeconds).toBe(0);
    expect(s.remainingSeconds).toBe(0);
    expect(s.completionToken).toBe(tokenAfterComplete);
    expect(s.startedAtMs).toBeNull();
    expect(s.baseRemainingSeconds).toBe(0);
  });

  it('reset 後に再度フェーズを完走すると completionToken がさらに +1 される', () => {
    useTimerStore.getState().start('input', 1);
    jest.advanceTimersByTime(1_000);
    useTimerStore.getState().recomputeRemaining();
    const first = useTimerStore.getState().completionToken;
    useTimerStore.getState().reset();
    useTimerStore.getState().start('output', 1);
    jest.advanceTimersByTime(1_000);
    useTimerStore.getState().recomputeRemaining();
    expect(useTimerStore.getState().completionToken).toBe(first + 1);
    expect(useTimerStore.getState().phase).toBe('output');
  });
});

/**
 * タイマー駆動ロジック。
 *
 * 責務:
 * - `timerStore` の状態 (phase / status / 残秒数) を React 側に橋渡しする
 * - `status === 'running'` の間だけ 1 秒ごとに `store.recomputeRemaining()` を呼ぶ
 *   interval を回す。store が `Date.now()` アンカー方式で再計算するため、
 *   JS がフォアグラウンドにある限り正確な残秒数が表示される。
 * - フェーズ完了 (`completionToken` の増加) を検知して `onComplete` を 1 度だけ呼ぶ
 * - AppState が background → active に戻った瞬間に即時 `recomputeRemaining()` を
 *   叩いて、画面復帰直後に最新の残秒数へ追いつかせる。これにより background
 *   中も実時間でタイマーが進んでいるように見える。
 *
 * 運用上の注意:
 * - 同一画面で `useTimer({ onComplete })` を呼ぶのは 1 箇所に絞ること。複数の hook
 *   インスタンスが interval を個別に所有すると、AppState listener も多重登録される。
 *   UI の時刻表示は `Timer` コンポーネントのように `useTimerStore` を直接購読する
 *   形で実装する。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useTimerStore, type TimerPhase, type TimerStatus } from '@/shared/stores/timerStore';

export type UseTimerOptions = {
  /**
   * false の間は interval 駆動と完了通知を止める。
   * 画面が mounted のまま blur されるナビゲーションで、裏画面から二重に tick しないために使う。
   */
  enabled?: boolean;
  /**
   * フェーズが完了した瞬間に呼ばれるコールバック。`completionToken` の変化に同期し、
   * 1 つの hook インスタンスにつき完了 1 回ごとに 1 回だけ呼ばれる。
   */
  onComplete?: (phase: TimerPhase) => void;
};

export type UseTimerResult = {
  phase: TimerPhase;
  status: TimerStatus;
  totalSeconds: number;
  remainingSeconds: number;
  /** `'MM:SS'` 形式のゼロパディング文字列。 */
  formatted: string;
  start: (phase: Exclude<TimerPhase, 'idle'>, seconds: number) => void;
  pause: () => void;
  resume: () => void;
  complete: () => void;
  reset: () => void;
};

/**
 * running 中の残り秒数を小数込みで補間し、円形プログレスを滑らかに描画するために使う。
 * 表示用の状態機械は整数秒のままにして、UI だけを `requestAnimationFrame` で補完する。
 */
export function useSmoothRemainingSeconds(enabled = true): number {
  const status = useTimerStore((s) => (enabled ? s.status : 'idle'));
  const remainingSeconds = useTimerStore((s) => (enabled ? s.remainingSeconds : 0));
  const [smoothRemainingSeconds, setSmoothRemainingSeconds] = useState(remainingSeconds);

  const anchorRemainingRef = useRef(remainingSeconds);
  const anchorTimestampRef = useRef(Date.now());

  useEffect(() => {
    anchorRemainingRef.current = remainingSeconds;
    anchorTimestampRef.current = Date.now();
    setSmoothRemainingSeconds(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    // jest (fake timers) 下では requestAnimationFrame / setTimeout が
    // 自己スケジュールを繰り返して `advanceTimersByTime` を埋め尽くし、
    // CI でテストがタイムアウトする。テストでは補間をスキップし、
    // store の整数秒をそのまま表示値にする。
    if (!enabled || status !== 'running' || process.env.NODE_ENV === 'test') {
      setSmoothRemainingSeconds(remainingSeconds);
      return;
    }

    let frameId = 0;
    const update = () => {
      const elapsedSeconds = (Date.now() - anchorTimestampRef.current) / 1000;
      const clampedElapsedSeconds = Math.min(elapsedSeconds, 0.999);
      const nextRemainingSeconds = Math.max(0, anchorRemainingRef.current - clampedElapsedSeconds);
      setSmoothRemainingSeconds(nextRemainingSeconds);
      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [enabled, remainingSeconds, status]);

  return smoothRemainingSeconds;
}

/**
 * `useSmoothRemainingSeconds` の間引き版。`intervalMs` ごとに 1 度だけ補間値を更新する。
 *
 * 砂時計のように、再描画コストが大きい SVG（ベースを SvgXml で再パースするなど）に
 * 対しては、毎フレーム更新すると JS スレッドが詰まってアニメーションが止まって見える。
 * 体感は十分滑らか（>= 10fps）に保ちつつ、再描画回数を抑えるためにこの hook を使う。
 */
export function useThrottledRemainingSeconds(intervalMs: number, enabled = true): number {
  const status = useTimerStore((s) => (enabled ? s.status : 'idle'));
  const remainingSeconds = useTimerStore((s) => (enabled ? s.remainingSeconds : 0));
  const [throttledRemainingSeconds, setThrottledRemainingSeconds] = useState(remainingSeconds);

  const anchorRemainingRef = useRef(remainingSeconds);
  const anchorTimestampRef = useRef(Date.now());

  useEffect(() => {
    anchorRemainingRef.current = remainingSeconds;
    anchorTimestampRef.current = Date.now();
    setThrottledRemainingSeconds(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    // テスト環境では setInterval が fake timers と競合するため、
    // store の整数秒をそのまま反映する（`useSmoothRemainingSeconds` と同方針）。
    if (!enabled || status !== 'running' || process.env.NODE_ENV === 'test') {
      setThrottledRemainingSeconds(remainingSeconds);
      return;
    }

    const id = setInterval(() => {
      const elapsedSeconds = (Date.now() - anchorTimestampRef.current) / 1000;
      const clampedElapsedSeconds = Math.min(elapsedSeconds, 0.999);
      const nextRemainingSeconds = Math.max(0, anchorRemainingRef.current - clampedElapsedSeconds);
      setThrottledRemainingSeconds(nextRemainingSeconds);
    }, intervalMs);

    return () => clearInterval(id);
  }, [enabled, remainingSeconds, status, intervalMs]);

  return throttledRemainingSeconds;
}

/** 秒数を `'MM:SS'` 形式の文字列にフォーマットする。負数は `'00:00'` にクランプする。 */
export function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useTimer(options: UseTimerOptions = {}): UseTimerResult {
  const enabled = options.enabled ?? true;
  const phase = useTimerStore((s) => s.phase);
  const status = useTimerStore((s) => s.status);
  const totalSeconds = useTimerStore((s) => s.totalSeconds);
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds);
  const completionToken = useTimerStore((s) => s.completionToken);

  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const recomputeRemaining = useTimerStore((s) => s.recomputeRemaining);
  const complete = useTimerStore((s) => s.complete);
  const reset = useTimerStore((s) => s.reset);

  const onCompleteRef = useRef(options.onComplete);
  useEffect(() => {
    onCompleteRef.current = options.onComplete;
  }, [options.onComplete]);

  useEffect(() => {
    if (!enabled || status !== 'running') return;
    const id = setInterval(() => {
      recomputeRemaining();
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, status, recomputeRemaining]);

  // AppState が active に戻った瞬間に即時再計算する。
  // background 中も `Date.now()` 基準で時計は進んでいるので、ここで recompute
  // すれば画面復帰直後にユーザーが見る remainingSeconds は実時間に追いつく。
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        recomputeRemaining();
      }
    });
    return () => subscription.remove();
  }, [enabled, recomputeRemaining]);

  const previousTokenRef = useRef(completionToken);
  useEffect(() => {
    if (!enabled) {
      previousTokenRef.current = completionToken;
      return;
    }
    if (completionToken !== previousTokenRef.current) {
      previousTokenRef.current = completionToken;
      onCompleteRef.current?.(phase);
    }
  }, [completionToken, enabled, phase]);

  const startCb = useCallback(
    (p: Exclude<TimerPhase, 'idle'>, seconds: number) => start(p, seconds),
    [start],
  );
  const pauseCb = useCallback(() => pause(), [pause]);
  const resumeCb = useCallback(() => resume(), [resume]);
  const completeCb = useCallback(() => complete(), [complete]);
  const resetCb = useCallback(() => reset(), [reset]);

  return {
    phase,
    status,
    totalSeconds,
    remainingSeconds,
    formatted: formatMmSs(remainingSeconds),
    start: startCb,
    pause: pauseCb,
    resume: resumeCb,
    complete: completeCb,
    reset: resetCb,
  };
}

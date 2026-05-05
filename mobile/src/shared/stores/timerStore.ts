/**
 * Zustand のタイマーストア。
 *
 * 学習サイクル (input -> output -> break -> ...) の残り時間と稼働状態を保持する。
 *
 * 設計メモ:
 * - `phase` (ライフサイクル段階) と `status` (稼働状態) を分離し、
 *   `'input-paused'` のような積表現を避ける。
 * - 残秒数は `Date.now()` アンカー方式で再計算する。`start` / `resume` / `extend`
 *   の各アクションが「running 開始時刻 (`startedAtMs`)」と「running 開始時の
 *   残秒数 (`baseRemainingSeconds`)」を確定し、`recomputeRemaining()` で
 *   `baseRemainingSeconds - (now - startedAtMs)` を計算して `remainingSeconds`
 *   へ反映する。これにより JS が background で停止していた間も実時間で進む。
 * - `tick()` のような「1 秒減らす」副作用は持たない。フォアグラウンドでの
 *   滑らかな表示は `useTimer` 側の `setInterval` が `recomputeRemaining()` を
 *   1 秒間隔で叩き、AppState change → 'active' でも即時再計算する。
 * - フェーズ完了通知は `completionToken` の単調増加で表現する。hook はこの値の
 *   変化を購読して `onComplete` を 1 回だけ発火することで、冪等性を担保する。
 */
import { create } from 'zustand';

export type TimerPhase = 'idle' | 'input' | 'output' | 'break';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export type TimerState = {
  phase: TimerPhase;
  status: TimerStatus;
  /** 現在のフェーズに割り当てられた合計秒数。進捗計算や表示に利用する。 */
  totalSeconds: number;
  /** 残り秒数。0 に達した瞬間に完了扱いになる。 */
  remainingSeconds: number;
  /**
   * フェーズ完了イベントの単調増加カウンタ。`complete()` が呼ばれるたびに
   * インクリメントされ、`useTimer` 側はこの値の変化を検知して `onComplete`
   * を 1 回だけ発火する。
   */
  completionToken: number;

  /**
   * running 状態に入った時刻 (`Date.now()`)。pause / completed / idle のときは null。
   * `recomputeRemaining()` の経過秒計算アンカー。
   */
  startedAtMs: number | null;
  /**
   * running 開始時点での残秒数。`startedAtMs` からの経過秒を引いて
   * 現在の残秒数を算出する。pause で確定し、resume で再アンカーする。
   */
  baseRemainingSeconds: number;

  /** 指定 phase / 秒数で running 状態に遷移する。0 秒以下なら即 completed 扱い。 */
  start: (phase: Exclude<TimerPhase, 'idle'>, seconds: number) => void;
  /** running -> paused (それ以外は no-op)。経過秒を確定して baseRemainingSeconds に反映する。 */
  pause: () => void;
  /** paused -> running (それ以外は no-op)。新しい anchor で running を再開する。 */
  resume: () => void;
  /**
   * 現在の `Date.now()` から経過秒を再計算して `remainingSeconds` を更新する。
   * running 以外では no-op。0 秒に到達した場合は completed へ遷移し
   * `completionToken` を +1 する。
   * - `useTimer` の setInterval (1 秒間隔) から呼ばれる
   * - AppState change で 'active' に戻ったタイミングからも呼ばれる
   */
  recomputeRemaining: () => void;
  /** 強制的に完了状態へ遷移させる。既に completed の場合は token を増やさない。 */
  complete: () => void;
  /**
   * running / paused 中に残り秒数と合計秒数へ `seconds` を加算する。
   * 進捗表示 (remaining / total) を崩さないよう totalSeconds も同時に増やす。
   * running 中は anchor をリセットして以後の経過秒計算が安定するようにする。
   * idle / completed では no-op。
   */
  extend: (seconds: number) => void;
  /** idle へ戻す。`completionToken` は保持する (履歴リセットは行わない)。 */
  reset: () => void;
};

function clampNonNegativeInt(seconds: number): number {
  return Math.max(0, Math.floor(seconds));
}

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: 'idle',
  status: 'idle',
  totalSeconds: 0,
  remainingSeconds: 0,
  completionToken: 0,
  startedAtMs: null,
  baseRemainingSeconds: 0,

  start: (phase, seconds) => {
    const safeSeconds = clampNonNegativeInt(seconds);
    if (safeSeconds === 0) {
      set((state) => ({
        phase,
        status: 'completed',
        totalSeconds: 0,
        remainingSeconds: 0,
        startedAtMs: null,
        baseRemainingSeconds: 0,
        completionToken: state.completionToken + 1,
      }));
      return;
    }
    set({
      phase,
      status: 'running',
      totalSeconds: safeSeconds,
      remainingSeconds: safeSeconds,
      startedAtMs: Date.now(),
      baseRemainingSeconds: safeSeconds,
    });
  },

  pause: () => {
    const { status, startedAtMs, baseRemainingSeconds } = get();
    if (status !== 'running') return;
    const elapsed =
      startedAtMs === null ? 0 : Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    const next = Math.max(0, baseRemainingSeconds - elapsed);
    set({
      status: 'paused',
      remainingSeconds: next,
      baseRemainingSeconds: next,
      startedAtMs: null,
    });
  },

  resume: () => {
    if (get().status !== 'paused') return;
    set((state) => ({
      status: 'running',
      startedAtMs: Date.now(),
      baseRemainingSeconds: state.remainingSeconds,
    }));
  },

  recomputeRemaining: () => {
    const { status, startedAtMs, baseRemainingSeconds } = get();
    if (status !== 'running' || startedAtMs === null) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    const next = baseRemainingSeconds - elapsed;
    if (next <= 0) {
      set((state) => ({
        remainingSeconds: 0,
        status: 'completed',
        startedAtMs: null,
        baseRemainingSeconds: 0,
        completionToken: state.completionToken + 1,
      }));
      return;
    }
    set({ remainingSeconds: next });
  },

  complete: () => {
    if (get().status === 'completed') return;
    set((state) => ({
      remainingSeconds: 0,
      status: 'completed',
      startedAtMs: null,
      baseRemainingSeconds: 0,
      completionToken: state.completionToken + 1,
    }));
  },

  extend: (seconds) => {
    const { status } = get();
    if (status !== 'running' && status !== 'paused') return;
    const add = clampNonNegativeInt(seconds);
    if (add === 0) return;
    set((state) => {
      const nextRemaining = state.remainingSeconds + add;
      // running 中は anchor をリセットして以降の経過秒計算を安定させる。
      // paused 中は startedAtMs が null のままで、resume 時に新規アンカーされる。
      const isRunning = state.status === 'running';
      return {
        remainingSeconds: nextRemaining,
        totalSeconds: state.totalSeconds + add,
        baseRemainingSeconds: nextRemaining,
        startedAtMs: isRunning ? Date.now() : null,
      };
    });
  },

  reset: () => {
    set({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
      startedAtMs: null,
      baseRemainingSeconds: 0,
    });
  },
}));

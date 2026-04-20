/**
 * Zustand のタイマーストア。
 *
 * 学習サイクル (input -> output -> break -> ...) の残り時間と稼働状態を保持する。
 *
 * 設計メモ:
 * - `phase` (ライフサイクル段階) と `status` (稼働状態) を分離し、
 *   `'input-paused'` のような積表現を避ける。
 * - 時間経過 (tick) は hook (`useTimer`) 側が所有する `setInterval` から呼び出され、
 *   本 store 自体は時間に依存しない pure な状態機械として動作する。
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

  /** 指定 phase / 秒数で running 状態に遷移する。0 秒以下なら即 completed 扱い。 */
  start: (phase: Exclude<TimerPhase, 'idle'>, seconds: number) => void;
  /** running -> paused (それ以外は no-op)。 */
  pause: () => void;
  /** paused -> running (それ以外は no-op)。 */
  resume: () => void;
  /** running 中に 1 秒減らす。残り 1 秒で呼ぶと completed に遷移して token を増やす。 */
  tick: () => void;
  /** 強制的に完了状態へ遷移させる。既に completed の場合は token を増やさない。 */
  complete: () => void;
  /**
   * running / paused 中に残り秒数と合計秒数へ `seconds` を加算する。
   * 進捗表示 (remaining / total) を崩さないよう totalSeconds も同時に増やす。
   * idle / completed では no-op。
   */
  extend: (seconds: number) => void;
  /** idle へ戻す。`completionToken` は保持する (履歴リセットは行わない)。 */
  reset: () => void;
};

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: 'idle',
  status: 'idle',
  totalSeconds: 0,
  remainingSeconds: 0,
  completionToken: 0,

  start: (phase, seconds) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    if (safeSeconds === 0) {
      set((state) => ({
        phase,
        status: 'completed',
        totalSeconds: 0,
        remainingSeconds: 0,
        completionToken: state.completionToken + 1,
      }));
      return;
    }
    set({
      phase,
      status: 'running',
      totalSeconds: safeSeconds,
      remainingSeconds: safeSeconds,
    });
  },

  pause: () => {
    if (get().status !== 'running') return;
    set({ status: 'paused' });
  },

  resume: () => {
    if (get().status !== 'paused') return;
    set({ status: 'running' });
  },

  tick: () => {
    const { status, remainingSeconds } = get();
    if (status !== 'running') return;
    const next = remainingSeconds - 1;
    if (next <= 0) {
      set((state) => ({
        remainingSeconds: 0,
        status: 'completed',
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
      completionToken: state.completionToken + 1,
    }));
  },

  extend: (seconds) => {
    const { status } = get();
    if (status !== 'running' && status !== 'paused') return;
    const add = Math.max(0, Math.floor(seconds));
    if (add === 0) return;
    set((state) => ({
      remainingSeconds: state.remainingSeconds + add,
      totalSeconds: state.totalSeconds + add,
    }));
  },

  reset: () => {
    set({
      phase: 'idle',
      status: 'idle',
      totalSeconds: 0,
      remainingSeconds: 0,
    });
  },
}));

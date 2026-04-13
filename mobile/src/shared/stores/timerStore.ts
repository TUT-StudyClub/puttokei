/**
 * Zustand のタイマーストア。Epic #3 でフェーズ遷移とカウントダウンを実装する。
 */
import { create } from 'zustand';

export type TimerPhase = 'idle' | 'input' | 'output' | 'break';

export type TimerState = {
  phase: TimerPhase;
  remainingSeconds: number;
  setPhase: (phase: TimerPhase) => void;
  setRemaining: (seconds: number) => void;
  reset: () => void;
};

export const useTimerStore = create<TimerState>((set) => ({
  phase: 'idle',
  remainingSeconds: 0,
  setPhase: (phase) => set({ phase }),
  setRemaining: (seconds) => set({ remainingSeconds: seconds }),
  reset: () => set({ phase: 'idle', remainingSeconds: 0 }),
}));

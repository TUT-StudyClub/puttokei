/**
 * 学習ループの進行状態を保持する Zustand ストア。
 *
 * `currentLoop` は 1 始まりで、ホーム画面の砂時計バッジで強調表示するインデックスとして使う。
 * メモリ内のみで保持するため、アプリ再起動でリセットされる。
 * 実際にループを進める処理 (セッション完了時など) は後続タスクで配線する想定。
 */
import { create } from 'zustand';

const MIN_LOOP = 1;
export const LOOP_COUNT_MAX = 8;

export type LoopState = {
  currentLoop: number;
  setCurrentLoop: (loop: number) => void;
  incrementLoop: () => void;
  reset: () => void;
};

function clamp(value: number) {
  if (Number.isNaN(value)) return MIN_LOOP;
  if (value < MIN_LOOP) return MIN_LOOP;
  if (value > LOOP_COUNT_MAX) return LOOP_COUNT_MAX;
  return value;
}

export const useLoopStore = create<LoopState>((set) => ({
  currentLoop: MIN_LOOP,
  setCurrentLoop: (loop) => set({ currentLoop: clamp(loop) }),
  incrementLoop: () => set((s) => ({ currentLoop: clamp(s.currentLoop + 1) })),
  reset: () => set({ currentLoop: MIN_LOOP }),
}));

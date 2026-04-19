/**
 * チュートリアル完了状態を保持する Zustand ストア。
 *
 * メモリ内のみで保持するため、アプリを再起動すると未完了に戻り、
 * 起動のたびにチュートリアルが表示される。
 * 永続化したい場合は AsyncStorage 等を組み合わせる。
 */
import { create } from 'zustand';

export type TutorialState = {
  completed: boolean;
  markCompleted: () => void;
  reset: () => void;
};

export const useTutorialStore = create<TutorialState>((set) => ({
  completed: false,
  markCompleted: () => set({ completed: true }),
  reset: () => set({ completed: false }),
}));

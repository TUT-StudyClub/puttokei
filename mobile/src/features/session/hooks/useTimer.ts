/**
 * タイマーロジック。Epic #3 で実装する。
 */
import { useTimerStore } from '@/shared/stores/timerStore';

export function useTimer() {
  return useTimerStore();
}

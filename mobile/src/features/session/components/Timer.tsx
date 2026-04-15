/**
 * 画面共通の `MM:SS` タイマー表示コンポーネント。
 *
 * 表示に徹し、pause/resume 等の操作は呼び出し側 (画面) で `useTimer()` 経由で行う。
 * 本コンポーネントは interval 駆動を持たず、`useTimerStore` の selector で
 * `remainingSeconds` だけを購読するため、同一画面で `useTimer({ onComplete })` を
 * 併用しても interval が二重に走らない。
 */
import type { ComponentProps } from 'react';
import { SizableText } from 'tamagui';

import { formatMmSs } from '@/features/session/hooks/useTimer';
import { useTimerStore } from '@/shared/stores/timerStore';

export type TimerProps = {
  size?: ComponentProps<typeof SizableText>['size'];
  testID?: string;
};

export function Timer({ size = '$10', testID = 'timer-display' }: TimerProps) {
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds);
  return (
    <SizableText size={size} testID={testID} fontWeight="700">
      {formatMmSs(remainingSeconds)}
    </SizableText>
  );
}

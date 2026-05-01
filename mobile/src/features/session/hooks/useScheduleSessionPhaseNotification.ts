/**
 * フェーズ完了時のローカル通知を予約する hook（BR-40〜42）。
 *
 * `enabled=true` の立ち上がりで、現在の timerStore の残秒数だけ後に通知を 1 件予約する。
 * `enabled=false` への遷移、unmount、`kind` の変化で予約をキャンセルする。
 *
 * 設計メモ:
 * - 残秒数は毎秒変動するため、useEffect の deps に入れず `getState()` で snapshot だけ読む。
 * - pause / resume は呼び出し側で `enabled` の遷移として表現する想定（pause で false、
 *   resume で true）。再予約のたびに新しい残秒数で schedule されるため、pause 中の
 *   経過時間は通知タイミングにそのまま反映される。
 * - extend は hook の外で発生したあと、画面が再 mount や enabled 切り替えで明示的に
 *   再予約をトリガーする必要がある。BR-40〜42 では extend 時の通知ズレは要件外。
 */
import { useEffect, useRef } from 'react';

import {
  cancelScheduledNotification,
  scheduleSessionPhaseNotification,
  type SessionPhaseNotificationKind,
} from '@/shared/lib/notifications';
import { useTimerStore } from '@/shared/stores/timerStore';

export type UseScheduleSessionPhaseNotificationOptions = {
  kind: SessionPhaseNotificationKind;
  enabled: boolean;
};

export function useScheduleSessionPhaseNotification(
  options: UseScheduleSessionPhaseNotificationOptions,
): void {
  const { kind, enabled } = options;
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const remainingSeconds = useTimerStore.getState().remainingSeconds;
    if (remainingSeconds <= 0) return;

    let cancelled = false;
    void (async () => {
      const id = await scheduleSessionPhaseNotification(kind, remainingSeconds);
      if (cancelled) {
        await cancelScheduledNotification(id);
        return;
      }
      idRef.current = id;
    })();

    return () => {
      cancelled = true;
      const id = idRef.current;
      idRef.current = null;
      if (id !== null) void cancelScheduledNotification(id);
    };
  }, [enabled, kind]);
}

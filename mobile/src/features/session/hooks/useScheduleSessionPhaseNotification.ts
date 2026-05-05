/**
 * フェーズ完了時のローカル通知を予約する hook（BR-40〜42）。
 *
 * `enabled=true` の立ち上がりで、現在の timerStore の残秒数だけ後に通知を 1 件予約する。
 * `enabled=false` への遷移、unmount、`kind` / `sessionId` の変化で予約をキャンセルする。
 *
 * 通知 data には sessionId と各 minutes を埋め込み、ユーザーが通知をタップして
 * アプリを開いたとき `SessionNotificationResponder` が次フェーズの画面へ
 * router.replace できるようにする。
 *
 * 設計メモ:
 * - 残秒数は毎秒変動するため、useEffect の deps に入れず `getState()` で snapshot だけ読む。
 * - pause / resume は呼び出し側で `enabled` の遷移として表現する想定（pause で false、
 *   resume で true）。再予約のたびに新しい残秒数で schedule されるため、pause 中の
 *   経過時間は通知タイミングにそのまま反映される。
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
  sessionId: string;
  inputMinutes: number;
  outputMinutes: number;
  breakMinutes: number;
};

export function useScheduleSessionPhaseNotification(
  options: UseScheduleSessionPhaseNotificationOptions,
): void {
  const { kind, enabled, sessionId, inputMinutes, outputMinutes, breakMinutes } = options;
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || sessionId === '') return;
    const remainingSeconds = useTimerStore.getState().remainingSeconds;
    if (remainingSeconds <= 0) return;

    let cancelled = false;
    void (async () => {
      const id = await scheduleSessionPhaseNotification(
        kind,
        { sessionId, inputMinutes, outputMinutes, breakMinutes },
        remainingSeconds,
      );
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
  }, [enabled, kind, sessionId, inputMinutes, outputMinutes, breakMinutes]);
}

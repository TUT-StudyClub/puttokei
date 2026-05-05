/**
 * フェーズ完了通知をユーザーがタップして開いた瞬間、次のフェーズ画面へ
 * router.replace するための非表示コンポーネント。
 *
 * BR-40〜42 のローカル通知 data に含まれる kind / sessionId / minutes を読み、
 * kind ごとに次フェーズ画面へ遷移させる。
 *
 * - kind === 'input': インプット時間が終わった通知。アウトプット画面に遷移し、
 *   backend status を 'output' に PATCH。**output タイマーは画面側で改めて開始
 *   する**ため、timerStore は `reset()` でクリアし、`done` パラメータも渡さない。
 * - kind === 'output': アウトプット時間が終わった通知。提出が未完了なので
 *   OutputScreen に戻し、「時間になりました」状態（done=1）で送信を促す。
 *   background で残った中途半端な remainingSeconds は `complete()` で 0 へ
 *   ジャンプさせて誤って再開しないようにする。
 * - kind === 'break': 休憩時間が終わった通知。BreakScreen を completed モード
 *   （done=1）で開き、次サイクル準備を表示する。
 *
 * `Notifications.useLastNotificationResponse()` でタスクキル復帰時とランタイムの
 * 両方を扱う。同一の通知を 2 度処理しないよう identifier を ref で記録する。
 */
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { updateSessionStatus } from '@/features/session/api/sessionApi';
import { useTimerStore } from '@/shared/stores/timerStore';

const KNOWN_KINDS = ['input', 'output', 'break'] as const;
type SessionPhaseKind = (typeof KNOWN_KINDS)[number];

function isSessionPhaseKind(value: unknown): value is SessionPhaseKind {
  return typeof value === 'string' && (KNOWN_KINDS as readonly string[]).includes(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function SessionNotificationResponder() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (response === null || response === undefined) return;
    const request = response.notification.request;
    const id = request.identifier;
    if (handledIdRef.current === id) return;

    const data = request.content.data as Record<string, unknown>;
    const kind = data.kind;
    const sessionId = readString(data.sessionId);
    if (!isSessionPhaseKind(kind) || sessionId === null) return;

    handledIdRef.current = id;

    const baseParams = {
      id: sessionId,
      input: readString(data.inputMinutes) ?? '',
      output: readString(data.outputMinutes) ?? '',
      break: readString(data.breakMinutes) ?? '',
    } as const;

    if (kind === 'input') {
      // インプット終了 → 次は output タイマーを画面側で開始する。
      // background で input フェーズの中途半端な remainingSeconds が残ったまま
      // OutputScreen が start('output', ...) を呼ぶと一瞬古い値がチラ見えするため、
      // ここで idle に戻しておく。done パラメータは渡さず通常起動経路に流す。
      useTimerStore.getState().reset();
      // タスクキル復帰の場合 backend の session.status は input のまま。
      // OutputScreen から submit するために output へ進めておく。すでに output 以降
      // ならエラーになるので握り潰す。
      void updateSessionStatus(sessionId, 'output').catch(() => undefined);
      router.replace({
        pathname: '/session/[id]/output',
        params: baseParams,
      });
    } else if (kind === 'output') {
      // アウトプット終了 → 提出が未完了なので OutputScreen に戻す。
      // done=1 でタイマー再起動を抑止し、「時間になりました」状態でユーザーの送信を待つ。
      // background で残っていた中途半端な remainingSeconds を 0 にジャンプさせる。
      useTimerStore.getState().complete();
      router.replace({
        pathname: '/session/[id]/output',
        params: { ...baseParams, done: '1' },
      });
    } else {
      // 休憩終了 → 休憩画面の completed モード（次サイクル準備）で起動。
      useTimerStore.getState().complete();
      router.replace({
        pathname: '/session/[id]/break',
        params: { ...baseParams, done: '1' },
      });
    }
  }, [response, router]);

  return null;
}

/**
 * フェーズ完了通知をユーザーがタップして開いた瞬間、次のフェーズ画面へ
 * router.replace するための非表示コンポーネント。
 *
 * BR-40〜42 のローカル通知 data に含まれる kind / sessionId / minutes を読み、
 * 通知発火時点でタイマーは終了しているはずなので、まず timerStore.complete() を
 * 呼んで残秒数を 0 へジャンプさせる（JS が background で停止していた間の
 * 中途半端な秒数から再開してしまう不具合の対策）。
 *
 * - kind === 'input': アウトプット画面へ replace、backend status を 'output' に PATCH
 * - kind === 'output': アウトプット画面へ戻す。提出が未完了なのでユーザーが
 *   送信できる状態（タイマー完了 + 「時間になりました」表示）にする
 * - kind === 'break': 休憩画面へ replace（next-cycle モード）
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

    // 通知発火時点でフェーズは時間切れのはずなので、JS background で残っていた
    // 中途半端な remainingSeconds を 0 にジャンプさせる。complete() は既に
    // completed の場合 no-op。
    useTimerStore.getState().complete();

    const baseParams = {
      id: sessionId,
      input: readString(data.inputMinutes) ?? '',
      output: readString(data.outputMinutes) ?? '',
      break: readString(data.breakMinutes) ?? '',
    } as const;

    if (kind === 'input') {
      // タスクキル復帰の場合 backend の session.status は input のまま。
      // OutputScreen から submit するために output へ進めておく。すでに output 以降
      // ならエラーになるので握り潰す。
      void updateSessionStatus(sessionId, 'output').catch(() => undefined);
      router.replace({
        pathname: '/session/[id]/output',
        params: { ...baseParams, done: '1' },
      });
    } else if (kind === 'output') {
      // アウトプット終了 → 提出が未完了なので OutputScreen に戻す。
      // done=1 でタイマー再起動を抑止し、「時間になりました」状態でユーザーの送信を待つ。
      router.replace({
        pathname: '/session/[id]/output',
        params: { ...baseParams, done: '1' },
      });
    } else {
      // 休憩終了 → 休憩画面の completed モード（次サイクル準備）で起動。
      router.replace({
        pathname: '/session/[id]/break',
        params: { ...baseParams, done: '1' },
      });
    }
  }, [response, router]);

  return null;
}

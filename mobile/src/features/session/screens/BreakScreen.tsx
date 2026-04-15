/**
 * 休憩フェーズ画面。
 *
 * 状態機械上は `judging` に相当（判定待ちの期間を UI 上は「休憩」として扱う）。
 * タイマー完了時に `PATCH status=judged` を送って結果画面に遷移する。
 * 実 LLM 判定は Epic #4 で追加予定で、本 Task ではダミー判定（遷移のみ）で終端する。
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Paragraph, SizableText, YStack } from 'tamagui';

import { SessionHeader } from '@/features/session/components/SessionHeader';
import { Timer } from '@/features/session/components/Timer';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useTimer } from '@/features/session/hooks/useTimer';
import { useUpdateSessionStatus } from '@/features/session/hooks/useUpdateSessionStatus';

type SessionRouteParams = {
  id?: string;
  break?: string;
};

export function BreakScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const updateStatus = useUpdateSessionStatus();

  const { start, reset } = useTimer({
    onComplete: () => {
      updateStatus.mutate(
        { sessionId, status: 'judged' },
        {
          onSuccess: () => {
            router.replace({
              pathname: '/session/[id]/result',
              params: { id: sessionId },
            });
          },
        },
      );
    },
  });

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start('break', breakMinutes * 60);
    return () => {
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <YStack flex={1}>
      <SessionHeader sessionId={sessionId} title="休憩" onBeforeCancel={reset} />
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$4" padding="$4">
        <Paragraph>休憩中です（判定結果を準備しています）</Paragraph>
        <Timer />
        {updateStatus.isError ? (
          <SizableText color="$red10" size="$2" testID="break-screen-error">
            通信エラーが発生しました。時間をおいて再度お試しください。
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}

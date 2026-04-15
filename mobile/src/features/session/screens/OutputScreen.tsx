/**
 * アウトプットフェーズ画面。
 *
 * タイマー完了時に `PATCH status=judging` を送って `/session/{id}/break` に遷移する。
 * アウトプット本体 (入力 UI の本格実装) は本 Task のスコープ外。
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
  output?: string;
  break?: string;
};

export function OutputScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const outputMinutes = Number(params.output) || DEFAULT_TIMER.output_minutes;
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const updateStatus = useUpdateSessionStatus();

  const { start, reset } = useTimer({
    onComplete: () => {
      updateStatus.mutate(
        { sessionId, status: 'judging' },
        {
          onSuccess: () => {
            router.replace({
              pathname: '/session/[id]/break',
              params: { id: sessionId, break: String(breakMinutes) },
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
    start('output', outputMinutes * 60);
    return () => {
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <YStack flex={1}>
      <SessionHeader sessionId={sessionId} title="アウトプット" onBeforeCancel={reset} />
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$4" padding="$4">
        <Paragraph>アウトプットを記入してください</Paragraph>
        <Timer />
        {updateStatus.isError ? (
          <SizableText color="$red10" size="$2" testID="output-screen-error">
            通信エラーが発生しました。時間をおいて再度お試しください。
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}

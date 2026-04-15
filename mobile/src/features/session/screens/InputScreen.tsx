/**
 * インプットフェーズ画面。
 *
 * マウント時に `useTimer.start('input', input_minutes * 60)` でカウントダウンを開始し、
 * タイマー完了時に `PATCH status=output` を送る。成功後に `/session/{id}/output` へ
 * `router.replace` で遷移する（history に残さない方針）。
 *
 * 学習素材の表示やノート機能は本 Task のスコープ外。
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
  input?: string;
  output?: string;
  break?: string;
};

export function InputScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const inputMinutes = Number(params.input) || DEFAULT_TIMER.input_minutes;
  const outputMinutes = Number(params.output) || DEFAULT_TIMER.output_minutes;
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const updateStatus = useUpdateSessionStatus();

  const { start, reset } = useTimer({
    onComplete: () => {
      updateStatus.mutate(
        { sessionId, status: 'output' },
        {
          onSuccess: () => {
            router.replace({
              pathname: '/session/[id]/output',
              params: {
                id: sessionId,
                output: String(outputMinutes),
                break: String(breakMinutes),
              },
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
    start('input', inputMinutes * 60);
    return () => {
      reset();
    };
    // 依存を意図的に空にしている: start/reset が参照として安定しているうえ、
    // startedRef で二重 start を防いでいるため再実行は不要。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <YStack flex={1}>
      <SessionHeader sessionId={sessionId} title="インプット" onBeforeCancel={reset} />
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$4" padding="$4">
        <Paragraph>インプットを進めてください</Paragraph>
        <Timer />
        {updateStatus.isError ? (
          <SizableText color="$red10" size="$2" testID="input-screen-error">
            通信エラーが発生しました。時間をおいて再度お試しください。
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}

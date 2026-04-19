/**
 * 休憩フェーズ画面。
 *
 * 状態機械上は `judging` に相当（判定待ちの期間を UI 上は「休憩」として扱う）。
 * タイマー完了後に結果画面へ遷移し、実際の判定取得は ResultScreen で行う。
 */
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Paragraph, YStack } from 'tamagui';

import { SessionHeader } from '@/features/session/components/SessionHeader';
import { Timer } from '@/features/session/components/Timer';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useTimer } from '@/features/session/hooks/useTimer';

type SessionRouteParams = {
  id?: string;
  break?: string;
};

export function BreakScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const isFocused = useIsFocused();

  const { start, reset } = useTimer({
    enabled: isFocused,
    onComplete: () => {
      router.replace({
        pathname: '/session/[id]/result',
        params: { id: sessionId },
      });
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
        <Paragraph>休憩中です。終了後に判定結果を確認します。</Paragraph>
        <Timer />
      </YStack>
    </YStack>
  );
}

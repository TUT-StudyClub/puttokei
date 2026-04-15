/**
 * 判定結果画面。
 *
 * Issue #41 の時点では `JudgmentCard` は Epic #4 で実装される placeholder 表示のみ。
 * 本画面は session が `judged` に到達した後に表示される終端画面で、中断操作は不要。
 */
import { useRouter } from 'expo-router';
import { Button, H2, Paragraph, YStack } from 'tamagui';

import { JudgmentCard } from '@/features/session/components/JudgmentCard';

export function ResultScreen() {
  const router = useRouter();

  return (
    <YStack flex={1}>
      <YStack paddingHorizontal="$4" paddingVertical="$3">
        <H2>判定結果</H2>
      </YStack>
      <YStack flex={1} padding="$4" gap="$4">
        <Paragraph>セッションお疲れさまでした。</Paragraph>
        <JudgmentCard />
        <Button themeInverse onPress={() => router.replace('/(tabs)')} testID="result-back-home">
          ホームへ戻る
        </Button>
      </YStack>
    </YStack>
  );
}

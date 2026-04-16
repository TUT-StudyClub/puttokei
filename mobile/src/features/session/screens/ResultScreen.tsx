/**
 * 判定結果画面。pending / error / rejected の出し分けを行う。
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, H2, Paragraph, Spinner, YStack } from 'tamagui';

import { JudgmentCard } from '@/features/session/components/JudgmentCard';
import { useJudgment } from '@/features/session/hooks/useJudgment';
import { isApiError } from '@/shared/lib/api';

type ResultRouteParams = {
  id?: string;
};

export function ResultScreen() {
  const params = useLocalSearchParams<ResultRouteParams>();
  const sessionId = params.id ?? '';
  const router = useRouter();
  const judgmentQuery = useJudgment(sessionId);

  const problemMessage = judgmentQuery.isError
    ? isApiError(judgmentQuery.error)
      ? (judgmentQuery.error.problem?.detail ??
        judgmentQuery.error.problem?.title ??
        '判定結果の取得に失敗しました。')
      : '判定結果の取得に失敗しました。'
    : null;

  if (judgmentQuery.isPending) {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3">
          <H2>判定結果</H2>
        </YStack>
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$4" padding="$4">
          <Spinner testID="result-loading" />
          <Paragraph>判定結果を確認しています。</Paragraph>
        </YStack>
      </YStack>
    );
  }

  if (judgmentQuery.isError || judgmentQuery.data === undefined) {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3">
          <H2>判定結果</H2>
        </YStack>
        <YStack flex={1} padding="$4" gap="$4" justifyContent="center">
          <Paragraph testID="result-error-message">
            {problemMessage ?? '判定結果の取得に失敗しました。'}
          </Paragraph>
          <Button themeInverse onPress={() => void judgmentQuery.refetch()} testID="result-retry">
            再試行する
          </Button>
          <Button onPress={() => router.replace('/(tabs)')} testID="result-back-home">
            ホームへ戻る
          </Button>
        </YStack>
      </YStack>
    );
  }

  if (judgmentQuery.data.kind === 'pending') {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3">
          <H2>判定結果</H2>
        </YStack>
        <YStack flex={1} padding="$4" gap="$4" justifyContent="center">
          <Paragraph testID="result-pending-detail">{judgmentQuery.data.pending.detail}</Paragraph>
          <Paragraph>このまま待つと自動で再確認します。</Paragraph>
          <Button themeInverse onPress={() => void judgmentQuery.refetch()} testID="result-refetch">
            今すぐ再確認
          </Button>
          <Button onPress={() => router.replace('/(tabs)')} testID="result-back-home">
            ホームへ戻る
          </Button>
        </YStack>
      </YStack>
    );
  }

  if (judgmentQuery.data.judgment.verdict === 'rejected') {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3">
          <H2>判定結果</H2>
        </YStack>
        <YStack flex={1} padding="$4" gap="$4" justifyContent="center">
          <Paragraph testID="result-rejected-message">
            {judgmentQuery.data.judgment.advice}
          </Paragraph>
          <Button themeInverse onPress={() => router.replace('/(tabs)')} testID="result-back-home">
            ホームへ戻る
          </Button>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1}>
      <YStack paddingHorizontal="$4" paddingVertical="$3">
        <H2>判定結果</H2>
      </YStack>
      <YStack flex={1} padding="$4" gap="$4">
        <Paragraph>セッションお疲れさまでした。</Paragraph>
        <JudgmentCard judgment={judgmentQuery.data.judgment} />
        <Button themeInverse onPress={() => router.replace('/(tabs)')} testID="result-back-home">
          ホームへ戻る
        </Button>
      </YStack>
    </YStack>
  );
}

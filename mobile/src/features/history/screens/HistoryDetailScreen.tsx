import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Button, H2, H3, Paragraph, Spinner, SizableText, XStack, YStack } from 'tamagui';

import { useJudgmentDetail } from '@/features/history/hooks/useJudgmentDetail';
import { JudgmentCard } from '@/features/session/components/JudgmentCard';
import { Card } from '@/shared/components/Card';
import { isApiError } from '@/shared/lib/api';
import {
  formatJudgedAt,
  JUDGMENT_VERDICT_COLORS,
  JUDGMENT_VERDICT_LABELS,
} from '@/shared/lib/judgmentPresentation';

type HistoryDetailRouteParams = {
  id?: string;
};

export function HistoryDetailScreen() {
  const params = useLocalSearchParams<HistoryDetailRouteParams>();
  const judgmentId = params.id ?? '';
  const router = useRouter();
  const judgmentQuery = useJudgmentDetail(judgmentId);

  const problemMessage = judgmentQuery.isError
    ? isApiError(judgmentQuery.error)
      ? (judgmentQuery.error.problem?.detail ??
        judgmentQuery.error.problem?.title ??
        '判定詳細の取得に失敗しました。')
      : '判定詳細の取得に失敗しました。'
    : null;

  if (judgmentId.length === 0) {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3">
          <H2>判定詳細</H2>
        </YStack>
        <YStack flex={1} justifyContent="center" gap="$4" padding="$4">
          <Paragraph testID="history-detail-invalid">
            判定 ID が指定されていないため詳細を表示できません。
          </Paragraph>
          <Button onPress={() => router.back()} testID="history-detail-back">
            一覧へ戻る
          </Button>
        </YStack>
      </YStack>
    );
  }

  if (judgmentQuery.isPending) {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
          <H2>判定詳細</H2>
          <Paragraph theme="alt2">選択した判定内容を再確認できます。</Paragraph>
        </YStack>
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$4" padding="$4">
          <Spinner testID="history-detail-loading" />
          <Paragraph>判定内容を読み込んでいます。</Paragraph>
        </YStack>
      </YStack>
    );
  }

  if (judgmentQuery.isError || judgmentQuery.data === undefined) {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
          <H2>判定詳細</H2>
          <Paragraph theme="alt2">選択した判定内容を再確認できます。</Paragraph>
        </YStack>
        <YStack flex={1} justifyContent="center" gap="$4" padding="$4">
          <Paragraph testID="history-detail-error-message">
            {problemMessage ?? '判定詳細の取得に失敗しました。'}
          </Paragraph>
          <Button
            themeInverse
            onPress={() => void judgmentQuery.refetch()}
            testID="history-detail-retry"
          >
            再取得する
          </Button>
          <Button onPress={() => router.back()} testID="history-detail-back">
            一覧へ戻る
          </Button>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1}>
      <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
        <H2>判定詳細</H2>
        <Paragraph theme="alt2">選択した判定内容を再確認できます。</Paragraph>
      </YStack>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <YStack gap="$4">
          <Card testID="history-detail-summary">
            <YStack gap="$3">
              <XStack alignItems="center" justifyContent="space-between" gap="$3">
                <H3>判定概要</H3>
                <SizableText
                  color={JUDGMENT_VERDICT_COLORS[judgmentQuery.data.verdict]}
                  fontWeight="700"
                  size="$3"
                >
                  {JUDGMENT_VERDICT_LABELS[judgmentQuery.data.verdict]}
                </SizableText>
              </XStack>
              <Paragraph>判定日時: {formatJudgedAt(judgmentQuery.data.judged_at)}</Paragraph>
            </YStack>
          </Card>

          <JudgmentCard judgment={judgmentQuery.data} title="判定内容" />

          <Button
            themeInverse
            onPress={() => void judgmentQuery.refetch()}
            testID="history-detail-refetch"
          >
            再取得する
          </Button>
          <Button onPress={() => router.back()} testID="history-detail-back">
            一覧へ戻る
          </Button>
        </YStack>
      </ScrollView>
    </YStack>
  );
}

import { type RelativePathString, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Button, H2, Paragraph, Spinner, YStack } from 'tamagui';

import { JudgmentListItem } from '@/features/history/components/JudgmentListItem';
import { useJudgments } from '@/features/history/hooks/useJudgments';
import { isApiError } from '@/shared/lib/api';

export function HistoryScreen() {
  const router = useRouter();
  const judgmentsQuery = useJudgments();

  const problemMessage = judgmentsQuery.isError
    ? isApiError(judgmentsQuery.error)
      ? (judgmentsQuery.error.problem?.detail ??
        judgmentsQuery.error.problem?.title ??
        '履歴の取得に失敗しました。')
      : '履歴の取得に失敗しました。'
    : null;

  if (judgmentsQuery.isPending) {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
          <H2>判定履歴</H2>
          <Paragraph theme="alt2">これまでの判定結果を確認できます。</Paragraph>
        </YStack>
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$4" padding="$4">
          <Spinner testID="history-loading" />
          <Paragraph>履歴を読み込んでいます。</Paragraph>
        </YStack>
      </YStack>
    );
  }

  if (judgmentsQuery.isError || judgmentsQuery.data === undefined) {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
          <H2>判定履歴</H2>
          <Paragraph theme="alt2">これまでの判定結果を確認できます。</Paragraph>
        </YStack>
        <YStack flex={1} justifyContent="center" gap="$4" padding="$4">
          <Paragraph testID="history-error-message">
            {problemMessage ?? '履歴の取得に失敗しました。'}
          </Paragraph>
          <Button themeInverse onPress={() => void judgmentsQuery.refetch()} testID="history-retry">
            再取得する
          </Button>
        </YStack>
      </YStack>
    );
  }

  if (judgmentsQuery.data.items.length === 0) {
    return (
      <YStack flex={1}>
        <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
          <H2>判定履歴</H2>
          <Paragraph theme="alt2">これまでの判定結果を確認できます。</Paragraph>
        </YStack>
        <YStack flex={1} justifyContent="center" gap="$4" padding="$4">
          <Paragraph testID="history-empty-message">
            まだ判定履歴がありません。セッションを完了するとここに表示されます。
          </Paragraph>
          <Button
            themeInverse
            onPress={() => void judgmentsQuery.refetch()}
            testID="history-refetch"
          >
            再取得する
          </Button>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1}>
      <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
        <H2>判定履歴</H2>
        <Paragraph theme="alt2">過去の判定結果から復習ポイントを見直せます。</Paragraph>
      </YStack>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <YStack gap="$3">
          {judgmentsQuery.data.items.map((judgment) => (
            <JudgmentListItem
              key={judgment.id}
              judgment={judgment}
              onPress={() => router.push(`../history/${judgment.id}` as RelativePathString)}
            />
          ))}

          <Button
            alignSelf="flex-start"
            onPress={() => void judgmentsQuery.refetch()}
            testID="history-refetch"
          >
            一覧を更新
          </Button>
        </YStack>
      </ScrollView>
    </YStack>
  );
}

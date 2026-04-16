/**
 * 統計画面。期間 (日/週/月) ごとに学習統計を取得してグラフとサマリーで表示する。
 *
 * 状態は useJudgments と同じ 4 分岐:
 *  - isPending: ローディング
 *  - isError: 取得失敗 + retry ボタン
 *  - 空データ: 促しメッセージ
 *  - 正常: Selector + SummaryCards + Chart
 */
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, H2, Paragraph, YStack } from 'tamagui';

import { PeriodSelector } from '@/features/stats/components/PeriodSelector';
import { StatsChart } from '@/features/stats/components/StatsChart';
import { StatsSummaryCards } from '@/features/stats/components/StatsSummaryCards';
import { useStats } from '@/features/stats/hooks/useStats';
import type { Period } from '@/features/stats/types';
import { isApiError } from '@/shared/lib/api';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';

function Header() {
  return (
    <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
      <H2>学習統計</H2>
      <Paragraph theme="alt2">期間を切り替えて学習量の推移を確認できます。</Paragraph>
    </YStack>
  );
}

export function StatsScreen() {
  const [period, setPeriod] = useState<Period>('daily');
  const statsQuery = useStats(period);

  const errorMessage = statsQuery.isError
    ? isApiError(statsQuery.error)
      ? (statsQuery.error.problem?.detail ??
        statsQuery.error.problem?.title ??
        '統計の取得に失敗しました。')
      : '統計の取得に失敗しました。'
    : null;

  const body = (() => {
    if (statsQuery.isPending) {
      return (
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$4">
          <LoadingIndicator />
          <Paragraph testID="stats-loading">統計を読み込んでいます。</Paragraph>
        </YStack>
      );
    }

    if (statsQuery.isError || statsQuery.data === undefined) {
      return (
        <YStack flex={1} justifyContent="center" gap="$4" padding="$4">
          <Paragraph testID="stats-error-message">
            {errorMessage ?? '統計の取得に失敗しました。'}
          </Paragraph>
          <Button themeInverse onPress={() => void statsQuery.refetch()} testID="stats-retry">
            再取得する
          </Button>
        </YStack>
      );
    }

    const { summary, points } = statsQuery.data;
    const isEmpty = summary.total_sessions === 0 && points.length === 0;

    if (isEmpty) {
      return (
        <YStack flex={1} justifyContent="center" gap="$4" padding="$4">
          <Paragraph testID="stats-empty-message">
            まだ統計データがありません。セッションを完了するとここに表示されます。
          </Paragraph>
          <Button
            themeInverse
            onPress={() => void statsQuery.refetch()}
            testID="stats-empty-refetch"
          >
            再取得する
          </Button>
        </YStack>
      );
    }

    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <YStack gap="$4">
          <StatsSummaryCards summary={summary} />
          <StatsChart points={points} />
          {statsQuery.isFetching ? (
            <Paragraph theme="alt2" testID="stats-refetching">
              最新データを取得中…
            </Paragraph>
          ) : null}
        </YStack>
      </ScrollView>
    );
  })();

  return (
    <YStack flex={1}>
      <Header />
      <YStack paddingHorizontal="$4" paddingBottom="$2">
        <PeriodSelector value={period} onChange={setPeriod} />
      </YStack>
      {body}
    </YStack>
  );
}

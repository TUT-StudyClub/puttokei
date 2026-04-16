/**
 * 統計サマリーを 4 枚のカードで表示する。
 *
 * - 総学習時間（分 → 'Xh Ym' に整形）
 * - 総セッション数
 * - 正答率（0..1 → パーセント）
 * - 連続学習日数
 */
import { Paragraph, SizableText, XStack, YStack } from 'tamagui';

import { Card } from '@/shared/components/Card';
import type { StatsSummary } from '@/features/stats/types';

type Props = {
  summary: StatsSummary;
};

function formatStudyMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

function formatCorrectRate(rate: number): string {
  const clamped = Math.max(0, Math.min(1, rate));
  return `${Math.round(clamped * 100)}%`;
}

type Metric = { label: string; value: string; testID: string };

export function StatsSummaryCards({ summary }: Props) {
  const metrics: Metric[] = [
    {
      label: '総学習時間',
      value: formatStudyMinutes(summary.total_study_minutes),
      testID: 'stats-summary-study-minutes',
    },
    {
      label: 'セッション数',
      value: `${summary.total_sessions}`,
      testID: 'stats-summary-sessions',
    },
    {
      label: '正答率',
      value: formatCorrectRate(summary.correct_rate),
      testID: 'stats-summary-correct-rate',
    },
    {
      label: '連続日数',
      value: `${summary.streak_days}日`,
      testID: 'stats-summary-streak',
    },
  ];

  return (
    <XStack flexWrap="wrap" gap="$3" testID="stats-summary-cards">
      {metrics.map((metric) => (
        <Card key={metric.testID} flexGrow={1} flexBasis="45%" minWidth={140}>
          <YStack gap="$1" testID={metric.testID}>
            <Paragraph theme="alt2" size="$2">
              {metric.label}
            </Paragraph>
            <SizableText size="$7" fontWeight="700">
              {metric.value}
            </SizableText>
          </YStack>
        </Card>
      ))}
    </XStack>
  );
}

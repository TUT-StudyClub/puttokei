/**
 * 期間別の統計を棒グラフで可視化する。
 *
 * - react-native-gifted-charts の BarChart を利用する。
 * - データ 0 件の場合は empty メッセージに差し替える。
 * - 指標は props.metric で切替可能 (study_minutes | sessions)。初版は study_minutes。
 */
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { H4, Paragraph, YStack } from 'tamagui';

import { Card } from '@/shared/components/Card';
import type { StatsDataPoint } from '@/features/stats/types';

type Metric = 'study_minutes' | 'sessions';

type Props = {
  points: StatsDataPoint[];
  metric?: Metric;
};

const METRIC_LABEL: Record<Metric, string> = {
  study_minutes: '学習時間 (分)',
  sessions: 'セッション数',
};

const BAR_COLOR = '#3b82f6';

export function StatsChart({ points, metric = 'study_minutes' }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  // 画面幅から Card padding (16*2) + chart padding (40) を差し引いた描画領域
  const chartWidth = Math.max(240, windowWidth - 32 - 40);

  const barData = useMemo(
    () =>
      points.map((point) => ({
        value: metric === 'sessions' ? point.sessions : point.study_minutes,
        label: point.label,
      })),
    [points, metric],
  );

  if (points.length === 0) {
    return (
      <Card>
        <YStack gap="$2" testID="stats-chart-empty">
          <H4>{METRIC_LABEL[metric]}</H4>
          <Paragraph theme="alt2">データがありません。</Paragraph>
        </YStack>
      </Card>
    );
  }

  return (
    <Card>
      <YStack gap="$3" testID="stats-chart">
        <H4>{METRIC_LABEL[metric]}</H4>
        <BarChart
          data={barData}
          width={chartWidth}
          height={200}
          barWidth={22}
          spacing={18}
          frontColor={BAR_COLOR}
          yAxisThickness={0}
          xAxisThickness={0}
          noOfSections={4}
          initialSpacing={10}
          hideRules
        />
      </YStack>
    </Card>
  );
}

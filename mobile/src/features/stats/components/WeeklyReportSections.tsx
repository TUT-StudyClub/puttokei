import { type RelativePathString, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Path, Svg } from 'react-native-svg';
import { Button, Paragraph, SizableText } from 'tamagui';

import type { WeeklyReportPoint } from '@/features/stats/types';
import type { OutputReviewItem } from '@/shared/types/session';

const submittedAtFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function PencilIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 19 L6.2 14.7 L15.4 5.5 L18.5 8.6 L9.3 17.8 Z" fill="#333333" />
      <Path d="M14.5 6.4 L17.6 9.5" stroke="#FFFFFF" strokeWidth={1.4} />
    </Svg>
  );
}

function buildOutputPreview(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= 44) return compact;
  return `${compact.slice(0, 44)}…`;
}

function formatSubmittedAt(value: string): string {
  return submittedAtFormatter.format(new Date(value));
}

export function SubjectChart({ points }: { points: WeeklyReportPoint[] }) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(260, width - 72);
  const maxHours = Math.max(
    1,
    Math.ceil(Math.max(...points.map((point) => point.study_minutes), 0) / 60),
  );
  const barData = useMemo(
    () =>
      points.map((point) => ({
        value: Number((point.study_minutes / 60).toFixed(2)),
        label: point.label,
      })),
    [points],
  );

  return (
    <View style={styles.subjectSection} testID="stats-subject-section">
      <SizableText style={styles.sectionTitle}>教科</SizableText>
      <View style={styles.chartWrap} testID="stats-weekly-chart">
        <SizableText style={styles.yAxisLabel}>時間(h)</SizableText>
        <BarChart
          data={barData}
          width={chartWidth}
          height={178}
          maxValue={maxHours}
          noOfSections={4}
          barWidth={22}
          spacing={17}
          initialSpacing={12}
          frontColor="#5367FF"
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor="#D6D6D6"
          rulesColor="#ECECEC"
          yAxisLabelSuffix="h"
          hideRules={false}
          barBorderTopLeftRadius={4}
          barBorderTopRightRadius={4}
        />
        <SizableText style={styles.xAxisLabel}>日にち</SizableText>
      </View>
    </View>
  );
}

export function OutputHistory({ items }: { items: OutputReviewItem[] }) {
  const router = useRouter();

  const handlePress = useCallback(
    (item: OutputReviewItem) => {
      if (item.judgment === null) return;
      router.push(`../history/${item.judgment.id}` as RelativePathString);
    },
    [router],
  );

  return (
    <View style={styles.historySection} testID="stats-output-history">
      <SizableText style={styles.sectionTitle}>アウトプット履歴</SizableText>
      {items.length === 0 ? (
        <View style={styles.emptyHistory} testID="stats-output-history-empty">
          <SizableText style={styles.emptyHistoryText}>
            この週のアウトプットはまだありません。
          </SizableText>
        </View>
      ) : (
        <View style={styles.historyList}>
          {items.map((item) => {
            const isPressable = item.judgment !== null;
            return (
              <Pressable
                key={item.output.id}
                accessibilityRole={isPressable ? 'button' : undefined}
                disabled={!isPressable}
                onPress={() => handlePress(item)}
                style={({ pressed }) => [
                  styles.historyItem,
                  pressed && isPressable ? styles.historyItemPressed : null,
                ]}
                testID={`stats-output-history-item-${item.output.id}`}
              >
                <View style={styles.historyIcon}>
                  <PencilIcon />
                </View>
                <View style={styles.historyContent}>
                  <View style={styles.historyMetaRow}>
                    <SizableText style={styles.historySubject}>
                      {item.subject} {item.topic}
                    </SizableText>
                    <SizableText style={styles.historyCycle}>
                      サイクル{item.cycle_index}
                    </SizableText>
                  </View>
                  <SizableText style={styles.historyPreview} numberOfLines={1}>
                    {buildOutputPreview(item.output.content)}
                  </SizableText>
                  <View style={styles.historyFooterRow}>
                    <SizableText style={styles.historyDate}>
                      {formatSubmittedAt(item.output.submitted_at)}
                    </SizableText>
                    <SizableText style={styles.historyStatus}>
                      {item.judgment === null ? '判定待ち' : '詳細'}
                    </SizableText>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function ErrorBody({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.messageBody}>
      <Paragraph testID="stats-error-message">{message}</Paragraph>
      <Button themeInverse onPress={onRetry} testID="stats-retry">
        再取得する
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  messageBody: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  subjectSection: {
    gap: 14,
  },
  sectionTitle: {
    color: '#333333',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  chartWrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  yAxisLabel: {
    alignSelf: 'flex-start',
    color: '#777777',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    marginBottom: 4,
    marginLeft: 8,
  },
  xAxisLabel: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 4,
  },
  historySection: {
    gap: 14,
    marginTop: 24,
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DADADA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  historyItemPressed: {
    opacity: 0.72,
  },
  historyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F4',
  },
  historyContent: {
    flex: 1,
    gap: 4,
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historySubject: {
    flex: 1,
    color: '#333333',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  historyCycle: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  historyPreview: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  historyFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDate: {
    color: '#999999',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  historyStatus: {
    color: '#5367FF',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  emptyHistory: {
    minHeight: 72,
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
  },
  emptyHistoryText: {
    color: '#777777',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});

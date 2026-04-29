import { useMemo } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { SizableText, Spinner } from 'tamagui';

import { buildMonthlyHighlightSummary } from '@/features/stats/lib/monthlyReport';
import type { WeeklyReportResponse } from '@/features/stats/types';

const HIGHLIGHT_BACKGROUND = require('../../../../assets/images/stats/highlight-background-1.png');
const MONTHLY_HIGHLIGHT_BACKGROUND = require('../../../../assets/images/stats/highlight-background-2.png');

function splitMinutes(minutes: number) {
  const safeMinutes = Math.max(0, minutes);
  return {
    hours: Math.floor(safeMinutes / 60),
    minutes: safeMinutes % 60,
  };
}

function MetricLine({ label, minutes }: { label: string; minutes: number }) {
  const parts = splitMinutes(minutes);
  return (
    <View style={styles.metricLine}>
      <SizableText style={styles.metricLabel}>{label}</SizableText>
      <View style={styles.metricValueRow}>
        <View style={styles.metricConnector} />
        {parts.hours > 0 ? (
          <>
            <SizableText style={styles.metricValue}>{parts.hours}</SizableText>
            <SizableText style={styles.metricUnit}>時間</SizableText>
          </>
        ) : null}
        <SizableText style={styles.metricValue}>{parts.minutes}</SizableText>
        <SizableText style={styles.metricUnit}>分</SizableText>
      </View>
    </View>
  );
}

export function HighlightCard({ data }: { data: WeeklyReportResponse }) {
  const total = splitMinutes(data.summary.total_study_minutes);
  return (
    <ImageBackground
      source={HIGHLIGHT_BACKGROUND}
      resizeMode="stretch"
      style={styles.highlightCard}
      imageStyle={styles.highlightBackground}
      testID="stats-highlight-card"
    >
      <View pointerEvents="none" style={styles.sessionBadge} testID="stats-session-badge">
        <SizableText style={styles.sessionBadgeText}>×{data.summary.total_sessions}</SizableText>
      </View>
      <View style={styles.highlightContent}>
        <SizableText style={styles.highlightCaption}>勉強時間合計</SizableText>
        <View style={styles.totalTimeRow}>
          <SizableText style={styles.totalTimeNumber}>{total.hours}</SizableText>
          <SizableText style={styles.totalTimeUnit}>時間</SizableText>
          <SizableText style={styles.totalTimeNumber}>{total.minutes}</SizableText>
          <SizableText style={styles.totalTimeUnit}>分</SizableText>
        </View>

        <View style={styles.highlightBody}>
          <View style={styles.highlightMetrics}>
            <MetricLine label="インプット" minutes={data.summary.input_minutes} />
            <MetricLine label="アウトプット" minutes={data.summary.output_minutes} />
            <View style={styles.breakPill}>
              <SizableText style={styles.breakPillText}>
                休憩{data.summary.break_minutes}分
              </SizableText>
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

export function HighlightPlaceholder() {
  return (
    <View
      style={[styles.highlightCard, styles.highlightPlaceholder]}
      testID="stats-highlight-loading"
    >
      <Spinner />
      <SizableText style={styles.placeholderText}>レポートを読み込んでいます。</SizableText>
    </View>
  );
}

export function MonthlyHighlightCard({
  reports,
  monthStart,
}: {
  reports: WeeklyReportResponse[];
  monthStart: string;
}) {
  const summary = useMemo(
    () => buildMonthlyHighlightSummary(reports, monthStart),
    [reports, monthStart],
  );

  return (
    <ImageBackground
      source={MONTHLY_HIGHLIGHT_BACKGROUND}
      resizeMode="stretch"
      style={styles.monthlyHighlightCard}
      imageStyle={styles.monthlyHighlightBackground}
      testID="monthly-highlight-card"
    >
      <View style={styles.monthlyHighlightContent}>
        <View style={styles.monthlyHighlightMetric}>
          <SizableText style={styles.monthlyHighlightLabel}>合計日数</SizableText>
          <View style={styles.monthlyHighlightValueRow}>
            <SizableText style={styles.monthlyHighlightNumber}>{summary.totalDays}</SizableText>
            <SizableText style={styles.monthlyHighlightUnit}>日</SizableText>
          </View>
        </View>
        <View style={styles.monthlyHighlightMetric}>
          <SizableText style={styles.monthlyHighlightLabel}>最高連続日数</SizableText>
          <View style={styles.monthlyHighlightValueRow}>
            <SizableText style={styles.monthlyHighlightNumber}>
              {summary.longestStreakDays}
            </SizableText>
            <SizableText style={styles.monthlyHighlightUnit}>日</SizableText>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  highlightCard: {
    width: '96%',
    maxWidth: 360,
    aspectRatio: 1264 / 1288,
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  highlightBackground: {},
  monthlyHighlightCard: {
    width: '96%',
    maxWidth: 330,
    aspectRatio: 1264 / 992,
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  monthlyHighlightBackground: {},
  monthlyHighlightContent: {
    flex: 1,
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginLeft: 20,
    paddingTop: 4,
  },
  monthlyHighlightMetric: {
    alignItems: 'center',
  },
  monthlyHighlightLabel: {
    color: '#333333',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
  },
  monthlyHighlightValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  monthlyHighlightNumber: {
    color: '#333333',
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 41,
  },
  monthlyHighlightUnit: {
    color: '#333333',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 32,
  },
  highlightContent: {
    flex: 1,
    paddingTop: 30,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  highlightPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderText: {
    color: '#777777',
    fontSize: 13,
    fontWeight: '600',
  },
  highlightCaption: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  totalTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  totalTimeNumber: {
    color: '#333333',
    fontSize: 40,
    fontWeight: '900',
    lineHeight: 45,
  },
  totalTimeUnit: {
    color: '#333333',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 31,
  },
  highlightBody: {
    alignItems: 'center',
    marginTop: 16,
  },
  highlightMetrics: {
    width: 166,
    alignSelf: 'flex-end',
    gap: 7,
  },
  sessionBadge: {
    position: 'absolute',
    top: '41.5%',
    left: '12.3%',
    zIndex: 2,
    width: 52,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-13deg' }],
  },
  sessionBadgeText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  metricLine: {
    gap: 2,
  },
  metricLabel: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricConnector: {
    width: 36,
    height: 1,
    backgroundColor: '#333333',
    marginRight: 2,
  },
  metricValue: {
    color: '#333333',
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 31,
  },
  metricUnit: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 25,
  },
  breakPill: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6D6D6',
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  breakPillText: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});

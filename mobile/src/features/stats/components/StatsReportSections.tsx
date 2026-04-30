import { type RelativePathString, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ImageBackground, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Path, Svg } from 'react-native-svg';
import { Button, Paragraph, SizableText, Spinner } from 'tamagui';

import {
  addMonthsToMonthStartKey,
  buildMonthlyHighlightSummary,
  getMonthCalendarDateKeys,
  getStudiedDateKeySet,
} from '@/features/stats/lib/monthlyReport';
import { addDaysToDateKey, getDateNumberLabel, getTokyoDateKey } from '@/features/stats/lib/week';
import type { WeeklyReportPoint, WeeklyReportResponse } from '@/features/stats/types';
import type { OutputReviewItem } from '@/features/session/types';

const HIGHLIGHT_BACKGROUND = require('../../../../assets/images/hilight-background-1.png');
const MONTHLY_HIGHLIGHT_BACKGROUND = require('../../../../assets/images/hilight-background-2.png');

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const MONTH_DAY_SLOT_HEIGHT = 38;
const MONTH_DAY_ROW_GAP = 2;
const MONTH_CALENDAR_ARROW_HEIGHT = 58;

const submittedAtFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function CalendarIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4 V7" stroke="#5367FF" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M17 4 V7" stroke="#5367FF" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M5 8 H19 V20 H5 Z" stroke="#5367FF" strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M5 12 H19" stroke="#5367FF" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19';
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d={path}
        stroke="#C9C9C9"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ExternalIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M14 5 H19 V10" stroke="#777777" strokeWidth={2} strokeLinecap="round" />
      <Path d="M19 5 L12 12" stroke="#777777" strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M10 7 H6 V18 H17 V14"
        stroke="#777777"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PencilIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 19 L6.2 14.7 L15.4 5.5 L18.5 8.6 L9.3 17.8 Z" fill="#333333" />
      <Path d="M14.5 6.4 L17.6 9.5" stroke="#FFFFFF" strokeWidth={1.4} />
    </Svg>
  );
}

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

export function MonthlyCalendar({
  monthStart,
  reports,
  onMonthChange,
}: {
  monthStart: string;
  reports: WeeklyReportResponse[];
  onMonthChange: (monthStart: string) => void;
}) {
  const todayKey = getTokyoDateKey();
  const monthPrefix = monthStart.slice(0, 7);
  const cells = useMemo(() => getMonthCalendarDateKeys(monthStart), [monthStart]);
  const rows = useMemo(
    () =>
      Array.from({ length: Math.ceil(cells.length / 7) }, (_value, index) =>
        cells.slice(index * 7, index * 7 + 7),
      ),
    [cells],
  );
  const studiedDateKeys = useMemo(() => getStudiedDateKeySet(reports), [reports]);
  const monthCalendarArrowTop =
    (rows.length * (MONTH_DAY_SLOT_HEIGHT + MONTH_DAY_ROW_GAP) - MONTH_CALENDAR_ARROW_HEIGHT) / 2;

  return (
    <View style={styles.monthCalendarRoot} testID="stats-month-calendar">
      <View style={styles.calendarWeekdayRow}>
        {WEEKDAY_LABELS.map((weekday) => (
          <View key={weekday} style={styles.calendarWeekdayCell}>
            <SizableText style={styles.calendarWeekdayText}>{weekday}</SizableText>
          </View>
        ))}
      </View>
      <View style={styles.monthCalendarGridWrap}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onMonthChange(addMonthsToMonthStartKey(monthStart, -1))}
          style={[
            styles.monthCalendarArrow,
            styles.monthCalendarArrowLeft,
            { top: monthCalendarArrowTop },
          ]}
          testID="month-calendar-prev"
        >
          <ArrowIcon direction="left" />
        </Pressable>
        <View style={styles.monthCalendarGrid}>
          {rows.map((row, rowIndex) => (
            <View key={`month-week-${rowIndex}`} style={styles.calendarWeekRow}>
              {row.map((dateKey, dayIndex) => {
                if (dateKey === null) {
                  return <View key={`blank-${rowIndex}-${dayIndex}`} style={styles.monthDaySlot} />;
                }

                const isStudied = studiedDateKeys.has(dateKey);
                const previousDateKey = addDaysToDateKey(dateKey, -1);
                const nextDateKey = addDaysToDateKey(dateKey, 1);
                const hasPreviousStudied = studiedDateKeys.has(previousDateKey);
                const hasNextStudied = studiedDateKeys.has(nextDateKey);
                const hasPreviousInlineStudied =
                  hasPreviousStudied && previousDateKey.startsWith(monthPrefix) && dayIndex > 0;
                const hasNextInlineStudied =
                  hasNextStudied && nextDateKey.startsWith(monthPrefix) && dayIndex < 6;
                const isStreakDay = isStudied && (hasPreviousStudied || hasNextStudied);
                const isSingleStudiedDay = isStudied && !isStreakDay;
                const isFuture = dateKey > todayKey;
                const isToday = dateKey === todayKey;
                const studiedTestSuffix = isStreakDay
                  ? 'streak'
                  : isSingleStudiedDay
                    ? 'single'
                    : 'empty';

                return (
                  <View
                    key={dateKey}
                    style={styles.monthDaySlot}
                    testID={`month-day-${dateKey}-${studiedTestSuffix}`}
                  >
                    <View
                      style={[
                        styles.monthDayMarker,
                        isStreakDay ? styles.monthDayStreakMarker : null,
                        isStreakDay && !hasPreviousInlineStudied
                          ? styles.monthDayStreakStart
                          : null,
                        isStreakDay && hasPreviousInlineStudied && hasNextInlineStudied
                          ? styles.monthDayStreakMiddle
                          : null,
                        isStreakDay && !hasNextInlineStudied ? styles.monthDayStreakEnd : null,
                        isToday ? styles.monthDayTodayMarker : null,
                      ]}
                    >
                      <SizableText
                        style={[
                          styles.monthDayText,
                          isFuture && !isStudied ? styles.monthDayMutedText : null,
                          isStudied ? styles.monthDayStudiedText : null,
                        ]}
                      >
                        {getDateNumberLabel(dateKey)}
                      </SizableText>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onMonthChange(addMonthsToMonthStartKey(monthStart, 1))}
          style={[
            styles.monthCalendarArrow,
            styles.monthCalendarArrowRight,
            { top: monthCalendarArrowTop },
          ]}
          testID="month-calendar-next"
        >
          <ArrowIcon direction="right" />
        </Pressable>
      </View>
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

export function buildOutputPreview(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= 44) return compact;
  return `${compact.slice(0, 44)}…`;
}

function formatSubmittedAt(value: string): string {
  return submittedAtFormatter.format(new Date(value));
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
  monthCalendarRoot: {
    alignItems: 'center',
    marginTop: 18,
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  calendarWeekdayCell: {
    width: 38,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWeekdayText: {
    color: '#333333',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  monthCalendarGridWrap: {
    position: 'relative',
    alignSelf: 'center',
    marginTop: 10,
  },
  monthCalendarGrid: {
    alignItems: 'center',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  monthCalendarArrow: {
    position: 'absolute',
    zIndex: 2,
    width: 38,
    height: MONTH_CALENDAR_ARROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCalendarArrowLeft: {
    left: -48,
  },
  monthCalendarArrowRight: {
    right: -48,
  },
  monthDaySlot: {
    width: 38,
    height: MONTH_DAY_SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MONTH_DAY_ROW_GAP,
  },
  monthDayMarker: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayStreakMarker: {
    backgroundColor: '#DDE5FF',
  },
  monthDayStreakStart: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  monthDayStreakMiddle: {
    borderRadius: 0,
  },
  monthDayStreakEnd: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  monthDayTodayMarker: {
    borderWidth: 1.8,
    borderColor: '#5367FF',
    borderRadius: 6,
  },
  monthDayText: {
    color: '#333333',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  monthDayMutedText: {
    color: '#CFCFCF',
  },
  monthDayStudiedText: {
    color: '#5367FF',
  },
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

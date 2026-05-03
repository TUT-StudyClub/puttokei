/**
 * 日単位のレポート画面。
 *
 * 上部の週ナビゲーションでは「表示週」と「選択日」を扱い、ハイライトカードと
 * アウトプット履歴は選択日のものを表示する。月単位の集計とカレンダーは
 * カレンダーボタンから切り替える。
 *
 * 未認証 / 匿名ユーザーはこの画面のデータを取得できないため、`/(auth)/sign-in` に誘導する。
 * サインイン成功後に戻ってこられるよう `returnTo` を渡している。
 */
import { Redirect, type RelativePathString, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQueries } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Path, Svg } from 'react-native-svg';
import { Button, Paragraph, SizableText, Spinner } from 'tamagui';

import { WeekDateStrip } from '@/features/stats/components/WeekDateStrip';
import { fetchWeeklyReport } from '@/features/stats/api/statsApi';
import { useDailyReport } from '@/features/stats/hooks/useDailyReport';
import { WEEKLY_REPORT_QUERY_KEY, useWeeklyReport } from '@/features/stats/hooks/useWeeklyReport';
import {
  addDaysToDateKey,
  getDateNumberLabel,
  getMonthLabel,
  getSundayWeekStartKey,
  getTokyoDateKey,
  parseDateKey,
  toDateKey,
} from '@/features/stats/lib/week';
import type {
  DailyReportSummary,
  WeeklyReportPoint,
  WeeklyReportResponse,
  WeeklyReportSummary,
} from '@/features/stats/types';
import type { OutputReviewItem } from '@/features/session/types';
import { OutputHistoryRow } from '@/shared/components/OutputHistoryRow';
import { isApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

const HIGHLIGHT_BACKGROUND = require('../../../../assets/images/backgrounds/highlight_weekly.png');
const MONTHLY_HIGHLIGHT_BACKGROUND = require('../../../../assets/images/backgrounds/highlight_monthly.png');
const CALENDAR_MONTH_ICON = require('../../../../assets/images/icons/icon_calendar_month.png');
const CALENDAR_DATE_ICON = require('../../../../assets/images/icons/icon_calendar_date.png');

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

type ReportViewMode = 'daily' | 'weekly' | 'monthly';

const MONTH_DAY_SLOT_HEIGHT = 38;
const MONTH_DAY_ROW_GAP = 2;
const MONTH_CALENDAR_ARROW_HEIGHT = 58;

function CalendarMonthIcon() {
  return <Image source={CALENDAR_MONTH_ICON} style={styles.calendarToggleIcon} />;
}

function CalendarDateIcon() {
  return <Image source={CALENDAR_DATE_ICON} style={styles.calendarToggleIcon} />;
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

function ExternalIcon() {
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

function getMonthStartKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  date.setDate(1);
  return toDateKey(date);
}

function daysBetweenDateKeys(targetKey: string, baseKey: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (parseDateKey(targetKey).getTime() - parseDateKey(baseKey).getTime()) / msPerDay,
  );
}

function getMonthDayLabel(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function addMonthsToMonthStartKey(monthStartKey: string, months: number): string {
  const monthStart = parseDateKey(monthStartKey);
  const shifted = new Date(monthStart.getFullYear(), monthStart.getMonth() + months, 1);
  return toDateKey(shifted);
}

function getMonthCalendarDateKeys(monthStartKey: string): (string | null)[] {
  const monthStart = parseDateKey(monthStartKey);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: monthStart.getDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toDateKey(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function getMonthWeekStartKeys(monthStartKey: string): string[] {
  const monthStart = parseDateKey(monthStartKey);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const monthEnd = new Date(year, month + 1, 0);
  const gridStart = new Date(year, month, 1 - monthStart.getDay());
  const gridEnd = new Date(year, month, monthEnd.getDate() + (6 - monthEnd.getDay()));
  const weekStarts: string[] = [];

  for (
    const cursor = new Date(gridStart);
    cursor <= gridEnd;
    cursor.setDate(cursor.getDate() + 7)
  ) {
    weekStarts.push(toDateKey(cursor));
  }
  return weekStarts;
}

function getStudiedDateKeySet(reports: readonly WeeklyReportResponse[]): Set<string> {
  const studiedDateKeys = new Set<string>();
  reports.forEach((report) => {
    report.points.forEach((point) => {
      if (point.study_minutes > 0) {
        studiedDateKeys.add(point.bucket);
      }
    });
  });
  return studiedDateKeys;
}

function getMonthlyStudiedDateKeys(
  reports: readonly WeeklyReportResponse[],
  monthStartKey: string,
): string[] {
  const monthPrefix = monthStartKey.slice(0, 7);
  return Array.from(getStudiedDateKeySet(reports))
    .filter((dateKey) => dateKey.startsWith(monthPrefix))
    .sort();
}

function buildMonthlyHighlightSummary(
  reports: readonly WeeklyReportResponse[],
  monthStartKey: string,
) {
  const studiedDateKeys = getMonthlyStudiedDateKeys(reports, monthStartKey);
  let longestStreakDays = 0;
  let currentStreakDays = 0;
  let previousDateKey: string | null = null;

  studiedDateKeys.forEach((dateKey) => {
    if (previousDateKey !== null && addDaysToDateKey(previousDateKey, 1) === dateKey) {
      currentStreakDays += 1;
    } else {
      currentStreakDays = 1;
    }
    longestStreakDays = Math.max(longestStreakDays, currentStreakDays);
    previousDateKey = dateKey;
  });

  return {
    totalDays: studiedDateKeys.length,
    longestStreakDays,
  };
}

function useMonthlyWeeklyReports(monthStartKey: string, enabled: boolean) {
  const idToken = useAuthStore((s) => s.idToken);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const weekStarts = useMemo(() => getMonthWeekStartKeys(monthStartKey), [monthStartKey]);
  const queries = useQueries({
    queries: weekStarts.map((weekStart) => ({
      queryKey: WEEKLY_REPORT_QUERY_KEY(weekStart),
      queryFn: () => fetchWeeklyReport(weekStart),
      enabled: enabled && idToken !== null && !isAnonymous,
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });

  return {
    reports: queries.flatMap((query) => (query.data ? [query.data] : [])),
    error: queries.find((query) => query.isError)?.error,
    isPending: enabled && queries.some((query) => query.isPending),
    isError: enabled && queries.some((query) => query.isError),
    isFetching: enabled && queries.some((query) => query.isFetching),
    refetch: () => {
      queries.forEach((query) => {
        void query.refetch();
      });
    },
  };
}

function getReportErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.problem?.detail ?? error.problem?.title ?? 'レポートの取得に失敗しました。';
  }
  return 'レポートの取得に失敗しました。';
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

function HighlightCard({ summary }: { summary: DailyReportSummary }) {
  const total = splitMinutes(summary.total_study_minutes);
  return (
    <ImageBackground
      source={HIGHLIGHT_BACKGROUND}
      resizeMode="stretch"
      style={styles.highlightCard}
      imageStyle={styles.highlightBackground}
      testID="stats-highlight-card"
    >
      <View pointerEvents="none" style={styles.sessionBadge} testID="stats-session-badge">
        <SizableText style={styles.sessionBadgeText}>×{summary.total_sessions}</SizableText>
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
            <MetricLine label="インプット" minutes={summary.input_minutes} />
            <MetricLine label="アウトプット" minutes={summary.output_minutes} />
            <View style={styles.breakPill}>
              <SizableText style={styles.breakPillText}>休憩{summary.break_minutes}分</SizableText>
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

function HighlightPlaceholder() {
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

function MonthlyCalendar({
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

function MonthlyHighlightCard({
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

const WEEKLY_CHART_SECTIONS = 5;

function formatHourLabel(hours: number): string {
  if (!Number.isFinite(hours) || hours === 0) return '';
  if (Number.isInteger(hours)) return String(hours);
  return hours.toFixed(1).replace(/\.0$/, '');
}

function WeeklyBarChart({ points }: { points: WeeklyReportPoint[] }) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(260, width - 72);
  const maxStudyMinutes = Math.max(...points.map((point) => point.study_minutes), 0);
  const maxHours = maxStudyMinutes / 60;
  const stepValue = maxHours <= 1 ? 0.2 : Math.max(1, Math.ceil(maxHours / WEEKLY_CHART_SECTIONS));
  const yAxisMax = stepValue * WEEKLY_CHART_SECTIONS;
  const barData = useMemo(
    () =>
      points.map((point) => ({
        value: point.study_minutes / 60,
      })),
    [points],
  );
  const yAxisLabelTexts = useMemo(
    () =>
      Array.from({ length: WEEKLY_CHART_SECTIONS + 1 }, (_value, index) =>
        formatHourLabel(stepValue * index),
      ),
    [stepValue],
  );

  return (
    <View style={styles.weeklyChartWrap} testID="stats-weekly-chart">
      <BarChart
        data={barData}
        width={chartWidth}
        height={200}
        maxValue={yAxisMax}
        noOfSections={WEEKLY_CHART_SECTIONS}
        stepValue={stepValue}
        yAxisLabelTexts={yAxisLabelTexts}
        formatYLabel={(label) => formatHourLabel(Number(label))}
        barWidth={22}
        spacing={17}
        initialSpacing={12}
        frontColor="#D6D6D6"
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor="#D6D6D6"
        rulesColor="#D6D6D6"
        rulesThickness={1}
        hideRules={false}
        showVerticalLines
        verticalLinesColor="#ECECEC"
        verticalLinesThickness={1}
        barBorderTopLeftRadius={4}
        barBorderTopRightRadius={4}
      />
    </View>
  );
}

function WeeklyHighlightCard({ summary }: { summary: WeeklyReportSummary }) {
  const total = splitMinutes(summary.total_study_minutes);
  return (
    <View style={styles.weeklyHighlightCard} testID="stats-weekly-highlight-card">
      <SizableText style={styles.weeklyHighlightCaption}>勉強時間合計</SizableText>
      <View style={styles.weeklyTotalRow}>
        {total.hours > 0 ? (
          <>
            <SizableText style={styles.weeklyTotalNumber}>{total.hours}</SizableText>
            <SizableText style={styles.weeklyTotalUnit}>時間</SizableText>
          </>
        ) : null}
        <SizableText style={styles.weeklyTotalNumber}>{total.minutes}</SizableText>
        <SizableText style={styles.weeklyTotalUnit}>分</SizableText>
      </View>
    </View>
  );
}

function OutputHistory({ items }: { items: OutputReviewItem[] }) {
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
      <View style={styles.historyCard}>
        {items.length === 0 ? (
          <View style={styles.emptyHistory} testID="stats-output-history-empty">
            <SizableText style={styles.emptyHistoryText}>
              この日のアウトプットはまだありません。
            </SizableText>
          </View>
        ) : (
          items.map((item, index) => (
            <OutputHistoryRow
              key={item.output.id}
              item={item}
              onPress={item.judgment !== null ? handlePress : undefined}
              isLast={index === items.length - 1}
              testID={`stats-output-history-item-${item.output.id}`}
            />
          ))
        )}
      </View>
    </View>
  );
}

function ErrorBody({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.messageBody}>
      <Paragraph testID="stats-error-message">{message}</Paragraph>
      <Button themeInverse onPress={onRetry} testID="stats-retry">
        再取得する
      </Button>
    </View>
  );
}

export function StatsScreen() {
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const todayKey = getTokyoDateKey();
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayKey);
  const weekStart = useMemo(
    () => getSundayWeekStartKey(parseDateKey(selectedDateKey)),
    [selectedDateKey],
  );
  const [reportViewMode, setReportViewMode] = useState<ReportViewMode>('daily');
  const [calendarMonthStart, setCalendarMonthStart] = useState(() => getMonthStartKey(weekStart));
  const dailyReportQuery = useDailyReport(selectedDateKey);
  const weeklyReportQuery = useWeeklyReport(weekStart, {
    enabled: reportViewMode === 'weekly',
  });
  const monthlyReports = useMonthlyWeeklyReports(calendarMonthStart, reportViewMode === 'monthly');
  const handleDailyRetry = useCallback(() => {
    void dailyReportQuery.refetch();
  }, [dailyReportQuery]);
  const handleWeeklyRetry = useCallback(() => {
    void weeklyReportQuery.refetch();
  }, [weeklyReportQuery]);
  const handleMonthlyRetry = useCallback(() => {
    monthlyReports.refetch();
  }, [monthlyReports]);
  const handleOpenMonthlyCalendar = useCallback(() => {
    setCalendarMonthStart(getMonthStartKey(weekStart));
    setReportViewMode('monthly');
  }, [weekStart]);
  const handleCloseMonthlyCalendar = useCallback(() => {
    setReportViewMode('daily');
  }, []);
  const handleWeekChange = useCallback(
    (newWeekStart: string) => {
      const offsetDays = daysBetweenDateKeys(newWeekStart, weekStart);
      setSelectedDateKey((current) => addDaysToDateKey(current, offsetDays));
    },
    [weekStart],
  );
  const handleSelectDate = useCallback(
    (dateKey: string) => {
      if (reportViewMode === 'daily' && dateKey === selectedDateKey) {
        setReportViewMode('weekly');
        return;
      }
      if (reportViewMode === 'weekly') {
        setReportViewMode('daily');
      }
      setSelectedDateKey(dateKey);
    },
    [reportViewMode, selectedDateKey],
  );

  if (uid === null || isAnonymous) {
    return (
      <Redirect
        href={{
          pathname: '/(auth)/sign-in',
          params: { returnTo: '/(tabs)/stats' },
        }}
      />
    );
  }

  const dailyErrorMessage = dailyReportQuery.isError
    ? getReportErrorMessage(dailyReportQuery.error)
    : null;
  const weeklyErrorMessage = weeklyReportQuery.isError
    ? getReportErrorMessage(weeklyReportQuery.error)
    : null;
  const monthlyErrorMessage = monthlyReports.isError
    ? getReportErrorMessage(monthlyReports.error)
    : null;
  const highlightTitle =
    selectedDateKey === todayKey
      ? '今日のハイライト'
      : `${getMonthDayLabel(selectedDateKey)}のハイライト`;

  const monthlyBody = (() => {
    if (monthlyReports.isPending) {
      return (
        <View style={styles.messageBody}>
          <Spinner testID="stats-monthly-loading" />
          <Paragraph>カレンダーを読み込んでいます。</Paragraph>
        </View>
      );
    }

    if (monthlyReports.isError) {
      return (
        <ErrorBody
          message={monthlyErrorMessage ?? 'レポートの取得に失敗しました。'}
          onRetry={handleMonthlyRetry}
        />
      );
    }

    return (
      <>
        <MonthlyCalendar
          monthStart={calendarMonthStart}
          reports={monthlyReports.reports}
          onMonthChange={setCalendarMonthStart}
        />
        <View style={styles.monthlyHighlightTitleRow}>
          <SizableText style={styles.highlightTitle}>今月のハイライト</SizableText>
          <ExternalIcon />
        </View>
        <MonthlyHighlightCard reports={monthlyReports.reports} monthStart={calendarMonthStart} />
        {monthlyReports.isFetching ? (
          <SizableText style={styles.refetchingText} testID="stats-monthly-refetching">
            最新データを取得中…
          </SizableText>
        ) : null}
      </>
    );
  })();

  const dailyBody = (() => {
    if (dailyReportQuery.isPending) {
      return (
        <View style={styles.messageBody}>
          <Spinner testID="stats-loading" />
          <Paragraph>レポートを読み込んでいます。</Paragraph>
        </View>
      );
    }

    if (dailyReportQuery.isError || dailyReportQuery.data === undefined) {
      return (
        <ErrorBody
          message={dailyErrorMessage ?? 'レポートの取得に失敗しました。'}
          onRetry={handleDailyRetry}
        />
      );
    }

    return (
      <>
        <OutputHistory items={dailyReportQuery.data.output_history} />
        {dailyReportQuery.isFetching ? (
          <SizableText style={styles.refetchingText} testID="stats-refetching">
            最新データを取得中…
          </SizableText>
        ) : null}
      </>
    );
  })();

  const weeklyBody = (() => {
    if (weeklyReportQuery.isPending) {
      return (
        <View style={styles.messageBody}>
          <Spinner testID="stats-weekly-loading" />
          <Paragraph>レポートを読み込んでいます。</Paragraph>
        </View>
      );
    }

    if (weeklyReportQuery.isError || weeklyReportQuery.data === undefined) {
      return (
        <ErrorBody
          message={weeklyErrorMessage ?? 'レポートの取得に失敗しました。'}
          onRetry={handleWeeklyRetry}
        />
      );
    }

    return (
      <>
        <WeeklyBarChart points={weeklyReportQuery.data.points} />
        <View style={styles.highlightTitleRow}>
          <SizableText style={styles.highlightTitle}>今週のハイライト</SizableText>
          <ExternalIcon />
        </View>
        <WeeklyHighlightCard summary={weeklyReportQuery.data.summary} />
        <OutputHistory items={weeklyReportQuery.data.output_history} />
        {weeklyReportQuery.isFetching ? (
          <SizableText style={styles.refetchingText} testID="stats-weekly-refetching">
            最新データを取得中…
          </SizableText>
        ) : null}
      </>
    );
  })();

  if (reportViewMode === 'monthly') {
    return (
      <SafeAreaView style={styles.safeArea} testID="stats-root">
        <StatusBar style="dark" />
        <ScrollView
          style={styles.monthlyScrollArea}
          contentContainerStyle={styles.monthlyContent}
          showsVerticalScrollIndicator={false}
          testID="stats-monthly-content"
        >
          <View style={styles.monthRow}>
            <SizableText style={styles.monthText}>{getMonthLabel(calendarMonthStart)}</SizableText>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={handleCloseMonthlyCalendar}
              style={styles.calendarButton}
              testID="stats-calendar-toggle"
            >
              <CalendarMonthIcon />
            </Pressable>
          </View>
          {monthlyBody}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (reportViewMode === 'weekly') {
    return (
      <SafeAreaView style={styles.safeArea} testID="stats-root">
        <StatusBar style="dark" />
        <View style={styles.fixedHeader}>
          <View style={styles.monthRow}>
            <SizableText style={styles.monthText}>{getMonthLabel(weekStart)}</SizableText>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={handleOpenMonthlyCalendar}
              style={styles.calendarButton}
              testID="stats-calendar-toggle"
            >
              <CalendarDateIcon />
            </Pressable>
          </View>
          <WeekDateStrip
            weekStart={weekStart}
            onWeekChange={handleWeekChange}
            selectedDateKey={selectedDateKey}
            onSelectDate={handleSelectDate}
          />
        </View>
        <View style={styles.scrollBoundary} />
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="stats-weekly-content"
        >
          {weeklyBody}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} testID="stats-root">
      <StatusBar style="dark" />
      <View style={styles.fixedHeader}>
        <View style={styles.monthRow}>
          <SizableText style={styles.monthText}>{getMonthLabel(weekStart)}</SizableText>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={handleOpenMonthlyCalendar}
            style={styles.calendarButton}
            testID="stats-calendar-toggle"
          >
            <CalendarDateIcon />
          </Pressable>
        </View>
        <WeekDateStrip
          weekStart={weekStart}
          onWeekChange={handleWeekChange}
          selectedDateKey={selectedDateKey}
          onSelectDate={handleSelectDate}
        />
        <View style={styles.highlightTitleRow}>
          <SizableText style={styles.highlightTitle}>{highlightTitle}</SizableText>
          <ExternalIcon />
        </View>
        {dailyReportQuery.data ? (
          <HighlightCard summary={dailyReportQuery.data.summary} />
        ) : (
          <HighlightPlaceholder />
        )}
      </View>
      <View style={styles.scrollBoundary} />
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="stats-scroll-content"
      >
        {dailyBody}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fixedHeader: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  calendarButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarToggleIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  monthText: {
    color: '#333333',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  monthlyScrollArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  monthlyContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
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
  highlightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  highlightTitle: {
    color: '#333333',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  monthlyHighlightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 18,
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
  scrollBoundary: {
    height: 1,
    backgroundColor: '#E4E4E4',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  scrollArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 18,
    paddingHorizontal: 24,
    paddingBottom: 112,
  },
  messageBody: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#333333',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  historySection: {
    gap: 8,
    marginTop: 4,
  },
  historyCard: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  emptyHistory: {
    minHeight: 40,
    justifyContent: 'center',
  },
  emptyHistoryText: {
    color: '#777777',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  refetchingText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 16,
  },
  weeklyChartWrap: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
  weeklyHighlightCard: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DADADA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  weeklyHighlightCaption: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  weeklyTotalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginTop: 6,
  },
  weeklyTotalNumber: {
    color: '#333333',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
  },
  weeklyTotalUnit: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 28,
  },
});

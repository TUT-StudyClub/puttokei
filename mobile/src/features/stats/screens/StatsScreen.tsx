/**
 * 日単位のレポート画面。
 *
 * 上部の週ナビゲーションでは「表示週」と「選択日」を扱い、ハイライトカードと
 * 履歴は選択日のものを表示する。月単位の集計とカレンダーは
 * カレンダーボタンから切り替える。
 *
 * 未認証 / 匿名ユーザーはこの画面のデータを取得できないため、`/(auth)/sign-in` に誘導する。
 * サインイン成功後に戻ってこられるよう `returnTo` を渡している。
 */
import { type Href, Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextStyle,
  type ViewStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { ClipPath, Defs, G, Line, Path, Rect, Svg, Text as SvgText } from 'react-native-svg';
import { Button, Paragraph, SizableText, Spinner } from 'tamagui';

import {
  getCenteredDateKeys,
  WEEK_DATE_STRIP_DAY_CELL_MAX_WIDTH,
  WEEK_DATE_STRIP_HORIZONTAL_INSET,
  WEEK_DATE_STRIP_HORIZONTAL_OUTSET,
  WEEK_DATE_STRIP_LAYOUT_GUTTER_WIDTH,
  WeekDateStrip,
} from '@/features/stats/components/WeekDateStrip';
import { fetchWeeklyReport, updateOutputSubject } from '@/features/stats/api/statsApi';
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
} from '@/features/stats/types';
import { AnnotatedOutputText } from '@/features/session/components/AnnotatedOutputText';
import { SessionSettingsButton } from '@/features/session/components/SessionPhaseChrome';
import type { OutputReviewItem } from '@/features/session/types';
import { isApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

const HIGHLIGHT_BACKGROUND = require('../../../../assets/images/backgrounds/highlight_weekly.png');
const MONTHLY_HIGHLIGHT_BACKGROUND = require('../../../../assets/images/backgrounds/highlight_monthly.png');
const CALENDAR_MONTH_ICON = require('../../../../assets/images/icons/icon_calendar_month.png');
const CALENDAR_DATE_ICON = require('../../../../assets/images/icons/icon_calendar_date.png');
const SHARE_ICON = require('../../../../assets/images/icons/icon_share.png');
const TEXT_MODE_ICON_BLACK = require('../../../../assets/images/icons/icon_pen_black.png');
const TEXT_MODE_ICON_GRAY = require('../../../../assets/images/icons/icon_pen_gray.png');
const IMAGE_MODE_ICON_BLACK = require('../../../../assets/images/icons/icon_pic_black..png');
const IMAGE_MODE_ICON_GRAY = require('../../../../assets/images/icons/icon_pic_gray..png');
const VOICE_MODE_ICON_BLACK = require('../../../../assets/images/icons/icon_mic_black.png');
const VOICE_MODE_ICON_GRAY = require('../../../../assets/images/icons/icon_mic_gray.png');
const COLOR_PICKER_CHECK_ICON = require('../../../../assets/images/icons/check.png');
const PLUS_ICON = require('../../../../assets/images/icons/plus.png');

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;
const STATS_SETTINGS_BUTTON_RIGHT = 34;
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const TOKYO_TIME_ZONE = 'Asia/Tokyo';
const UNSET_SUBJECT_LABEL = '未設定';
const UNSELECTED_SUBJECT_COLOR = '#D0D0D0';
const SUBJECT_COLOR_PALETTE = [
  '#457DFF',
  '#2BAAF3',
  '#00E0C6',
  '#2DDF39',
  '#F7E927',
  '#FF9147',
  '#FF484B',
  '#F84897',
  '#C251E2',
  '#AC6700',
] as const;
const SUBJECT_COLOR_PICKER_COLUMN_COUNT = 5;
const SUBJECT_COLOR_PICKER_ROWS = Array.from(
  { length: Math.ceil(SUBJECT_COLOR_PALETTE.length / SUBJECT_COLOR_PICKER_COLUMN_COUNT) },
  (_, rowIndex) =>
    SUBJECT_COLOR_PALETTE.slice(
      rowIndex * SUBJECT_COLOR_PICKER_COLUMN_COUNT,
      (rowIndex + 1) * SUBJECT_COLOR_PICKER_COLUMN_COUNT,
    ),
);
const SUBJECT_COLOR_PICKER_SWATCH_SIZE = 50;
const SUBJECT_COLOR_PICKER_COLUMN_GAP = 14;
const SUBJECT_COLOR_PICKER_ROW_GAP = 16;
const SUBJECT_COLOR_PICKER_HORIZONTAL_PADDING = 19;
const SUBJECT_COLOR_PICKER_TOP_PADDING = 22;
const SUBJECT_COLOR_PICKER_HEADER_BUTTON_TOP = 18;
const SUBJECT_COLOR_PICKER_HEADER_TITLE_MARGIN_TOP = 7;
const SUBJECT_PICKER_PADDING_TOP = 17;
const SUBJECT_PICKER_PADDING_BOTTOM = 18;
const SUBJECT_PICKER_HEADER_HEIGHT = 24;
const SUBJECT_PICKER_LIST_MARGIN_TOP = 9;
const SUBJECT_PICKER_ITEM_HEIGHT = 24;
const SUBJECT_PICKER_ITEM_GAP = 6;
const SUBJECT_PICKER_MAX_VISIBLE_ITEMS = 5;
const SUBJECT_PICKER_LIST_BOTTOM_PADDING = 2;
const HISTORY_SHEET_TOP_RADIUS = 28;
const HISTORY_OUTPUT_MODE_TABS = [
  {
    key: 'text',
    label: 'テキスト',
    activeIcon: TEXT_MODE_ICON_BLACK,
    inactiveIcon: TEXT_MODE_ICON_GRAY,
  },
  {
    key: 'image',
    label: '画像',
    activeIcon: IMAGE_MODE_ICON_BLACK,
    inactiveIcon: IMAGE_MODE_ICON_GRAY,
  },
  {
    key: 'voice',
    label: '音声',
    activeIcon: VOICE_MODE_ICON_BLACK,
    inactiveIcon: VOICE_MODE_ICON_GRAY,
  },
] as const;

type ReportViewMode = 'daily' | 'weekly' | 'monthly';
type SubjectOption = {
  label: string;
  color: string;
};
type HistoryGroup = {
  dateKey: string;
  dateLabel: string | null;
  items: OutputReviewItem[];
};
type WeeklyBarSegment = {
  outputId: string;
  minutes: number;
  color: string | null;
};

const MONTH_DAY_SLOT_HEIGHT = 38;
const MONTH_DAY_ROW_GAP = 2;
const MONTH_CALENDAR_ARROW_HEIGHT = 58;
const MONTH_CALENDAR_ARROW_OUTSET = 22;
const WEEKLY_CHART_HEIGHT = 330;
const WEEKLY_CHART_AXIS_Y = 288;
const FIXED_HEADER_HORIZONTAL_PADDING = 24;
const FIXED_HEADER_BOTTOM_PADDING = 24;
const SCROLL_BOUNDARY_HEIGHT = 2;
const HIGHLIGHT_CARD_WIDTH_RATIO = 0.96;
const HIGHLIGHT_CARD_MAX_WIDTH = 360;
const HIGHLIGHT_CARD_ASPECT_RATIO = 1264 / 1288;
const WEEKLY_CHART_WRAP_MIN_HEIGHT = 350;
const WEEKLY_CHART_WRAP_PADDING_TOP = 4;
const WEEKLY_CHART_WRAP_PADDING_BOTTOM = 8;
const WEEKLY_CHART_SLOT_MIN_HEIGHT = 360;
const WEEKLY_CALENDAR_GRAPH_BOUNDARY_BOTTOM = 36;
const WEEKLY_CHART_FRAME_TOP_OFFSET =
  (WEEKLY_CHART_SLOT_MIN_HEIGHT - WEEKLY_CHART_WRAP_MIN_HEIGHT) / 2 +
  WEEKLY_CHART_WRAP_PADDING_TOP +
  (WEEKLY_CHART_WRAP_MIN_HEIGHT -
    WEEKLY_CHART_WRAP_PADDING_TOP -
    WEEKLY_CHART_WRAP_PADDING_BOTTOM -
    WEEKLY_CHART_HEIGHT) /
    2;
const WEEKLY_CHART_TO_BOUNDARY_EXTENSION =
  WEEKLY_CALENDAR_GRAPH_BOUNDARY_BOTTOM + WEEKLY_CHART_FRAME_TOP_OFFSET;
const WEEKLY_CHART_PLOT_TOP = -8;
const WEEKLY_CHART_GRID_TOP = -WEEKLY_CHART_TO_BOUNDARY_EXTENSION;
const WEEKLY_CHART_TOP_OVERFLOW = WEEKLY_CHART_TO_BOUNDARY_EXTENSION + 16;
const WEEKLY_CHART_PLOT_HEIGHT = WEEKLY_CHART_AXIS_Y - WEEKLY_CHART_PLOT_TOP;
const WEEKLY_HISTORY_UP_OFFSET = -32;
const DAILY_HIGHLIGHT_CARD_HEIGHT_REDUCTION = -WEEKLY_HISTORY_UP_OFFSET;
const DAILY_HIGHLIGHT_CARD_EXTRA_HEIGHT = 8;
const DAILY_HIGHLIGHT_CARD_EXTRA_WIDTH = 4;
const DAILY_HIGHLIGHT_CARD_TRANSLATE_Y = 4;
const DAILY_HIGHLIGHT_METRICS_TRANSLATE_X = 16;
const DAILY_HIGHLIGHT_TITLE_TRANSLATE_X = 4;
const DAILY_HIGHLIGHT_TITLE_ROW_TRANSLATE_Y = 8;
const DAILY_WEEKLY_CALENDAR_STRIP_HORIZONTAL_OUTSET = 9;

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

function ShareIconButton() {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} style={styles.shareButton}>
      <Image source={SHARE_ICON} style={styles.shareIcon} />
    </Pressable>
  );
}

function CloseIcon({ size = 18, testID }: { size?: number; testID?: string } = {}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M6 6 L18 18" stroke="#4B4B4B" strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M18 6 L6 18" stroke="#4B4B4B" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon({ size = 18, testID }: { size?: number; testID?: string } = {}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path
        d="M5 12.4 L9.4 16.8 L19 7.2"
        stroke="#5367FF"
        strokeWidth={2.5}
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

function getSubjectLabel(subject: string): string {
  const trimmedSubject = subject.trim();
  return trimmedSubject.length > 0 ? trimmedSubject : UNSET_SUBJECT_LABEL;
}

function isUnsetSubject(subject: string): boolean {
  return getSubjectLabel(subject) === UNSET_SUBJECT_LABEL;
}

function appendSubjectOptionIfMissing(options: SubjectOption[], subject: SubjectOption | null) {
  if (subject === null) return;
  if (options.some((option) => option.label === subject.label)) return;

  options.push(subject);
}

function buildSubjectOptions(items: readonly OutputReviewItem[]): SubjectOption[] {
  const subjects = new Map<string, SubjectOption>();

  items.forEach((item) => {
    if (isUnsetSubject(item.subject)) return;

    const label = getSubjectLabel(item.subject);
    const existingSubject = subjects.get(label);
    if (existingSubject && item.subject_color === null) return;

    subjects.set(label, {
      label,
      color:
        item.subject_color ?? SUBJECT_COLOR_PALETTE[subjects.size % SUBJECT_COLOR_PALETTE.length]!,
    });
  });

  return [...subjects.values()];
}

function getEffectiveSubjectOption(
  item: OutputReviewItem,
  subjectOptions: readonly SubjectOption[],
  selectedSubjectByOutputId: Readonly<Record<string, SubjectOption>>,
): SubjectOption | null {
  const selectedSubject = selectedSubjectByOutputId[item.output.id];
  if (selectedSubject) return selectedSubject;

  const subjectLabel = getSubjectLabel(item.subject);
  if (!isUnsetSubject(item.subject) && item.subject_color !== null) {
    return {
      label: subjectLabel,
      color: item.subject_color,
    };
  }
  return subjectOptions.find((subject) => subject.label === subjectLabel) ?? null;
}

function applyOutputSubjectToReportCache<T>(
  report: T,
  outputId: string,
  subject: SubjectOption,
  subjectId: string | null,
): T {
  if (typeof report !== 'object' || report === null) return report;
  const maybeReport = report as { output_history?: unknown };
  if (!Array.isArray(maybeReport.output_history)) return report;

  let changed = false;
  const outputHistory = maybeReport.output_history.map((item) => {
    const historyItem = item as OutputReviewItem;
    if (historyItem.output?.id !== outputId) return item;

    changed = true;
    return {
      ...historyItem,
      subject: subject.label,
      subject_id: subjectId,
      subject_color: subject.color,
    };
  });

  if (!changed) return report;
  return {
    ...report,
    output_history: outputHistory,
  };
}

function sortHistoryItemsByRecency(items: readonly OutputReviewItem[]): OutputReviewItem[] {
  return [...items].sort((a, b) => {
    const timeDiff = getHistoryTimestampMs(b) - getHistoryTimestampMs(a);
    if (timeDiff !== 0) return timeDiff;
    return b.cycle_index - a.cycle_index;
  });
}

function getOutputReviewStudyMinutes(item: OutputReviewItem): number {
  return Math.max(0, item.input_minutes + item.output_minutes);
}

function buildWeeklyBarSegmentsByDateKey(
  items: readonly OutputReviewItem[],
  subjectOptions: readonly SubjectOption[],
  selectedSubjectByOutputId: Readonly<Record<string, SubjectOption>>,
): Record<string, WeeklyBarSegment[]> {
  const segmentsByDateKey: Record<string, WeeklyBarSegment[]> = {};
  const orderedItems = [...items].sort((a, b) => {
    const timeDiff = getHistoryTimestampMs(a) - getHistoryTimestampMs(b);
    if (timeDiff !== 0) return timeDiff;
    return a.cycle_index - b.cycle_index;
  });

  orderedItems.forEach((item) => {
    const minutes = getOutputReviewStudyMinutes(item);
    if (minutes <= 0) return;

    const dateKey = getTokyoDateKeyFromTimestamp(item.output.submitted_at);
    const subject = getEffectiveSubjectOption(item, subjectOptions, selectedSubjectByOutputId);
    const segments = segmentsByDateKey[dateKey] ?? [];
    segments.push({
      outputId: item.output.id,
      minutes,
      color: subject?.color ?? null,
    });
    segmentsByDateKey[dateKey] = segments;
  });

  return segmentsByDateKey;
}

function getSubjectPickerListHeight(subjectCount: number): number {
  if (subjectCount === 0) return 0;
  return (
    subjectCount * SUBJECT_PICKER_ITEM_HEIGHT +
    (subjectCount - 1) * SUBJECT_PICKER_ITEM_GAP +
    SUBJECT_PICKER_LIST_BOTTOM_PADDING
  );
}

function getSubjectPickerHeight(subjectCount: number): number {
  const visibleSubjectCount = Math.min(subjectCount, SUBJECT_PICKER_MAX_VISIBLE_ITEMS);
  const listHeight =
    visibleSubjectCount > 0
      ? SUBJECT_PICKER_LIST_MARGIN_TOP + getSubjectPickerListHeight(visibleSubjectCount)
      : 0;

  return (
    SUBJECT_PICKER_PADDING_TOP +
    SUBJECT_PICKER_HEADER_HEIGHT +
    listHeight +
    SUBJECT_PICKER_PADDING_BOTTOM
  );
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

function parseTimestamp(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getTokyoDatePart(value: string, partType: Intl.DateTimeFormatPartTypes): string | null {
  const date = parseTimestamp(value);
  if (date === null) return null;
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TOKYO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.formatToParts(date).find((part) => part.type === partType)?.value ?? null;
}

function getTokyoDateKeyFromTimestamp(value: string): string {
  const year = getTokyoDatePart(value, 'year');
  const month = getTokyoDatePart(value, 'month');
  const day = getTokyoDatePart(value, 'day');
  if (year === null || month === null || day === null) return 'unknown';
  return `${year}-${month}-${day}`;
}

function getTokyoMonthDayLabelFromTimestamp(value: string): string {
  const month = getTokyoDatePart(value, 'month');
  const day = getTokyoDatePart(value, 'day');
  if (month === null || day === null) return '日付不明';
  return `${Number(month)}月${Number(day)}日`;
}

function formatTokyoTimeLabel(value: string): string {
  const hour = getTokyoDatePart(value, 'hour');
  const minute = getTokyoDatePart(value, 'minute');
  if (hour === null || minute === null) return '--：--';
  return `${hour}：${minute}`;
}

function getHistoryTimestampMs(item: OutputReviewItem): number {
  return parseTimestamp(item.session_started_at)?.getTime() ?? 0;
}

function getHistoryTimeRangeParts(item: OutputReviewItem): { start: string; end: string } {
  return {
    start: formatTokyoTimeLabel(item.session_started_at),
    end: formatTokyoTimeLabel(item.output.submitted_at),
  };
}

function buildHistoryGroups(items: OutputReviewItem[], fallbackDateKey?: string): HistoryGroup[] {
  if (items.length === 0) {
    return [
      {
        dateKey: fallbackDateKey ?? 'empty',
        dateLabel: fallbackDateKey ? getMonthDayLabel(fallbackDateKey) : null,
        items: [],
      },
    ];
  }

  const groupsByDate = new Map<string, HistoryGroup>();
  const orderedItems = sortHistoryItemsByRecency(items);

  orderedItems.forEach((item) => {
    const dateKey = getTokyoDateKeyFromTimestamp(item.output.submitted_at);
    const existingGroup = groupsByDate.get(dateKey);
    if (existingGroup) {
      existingGroup.items.push(item);
      return;
    }

    groupsByDate.set(dateKey, {
      dateKey,
      dateLabel: getTokyoMonthDayLabelFromTimestamp(item.output.submitted_at),
      items: [item],
    });
  });

  return Array.from(groupsByDate.values());
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

function getHighlightCardSize(viewportWidth: number) {
  const headerContentWidth = Math.max(0, viewportWidth - FIXED_HEADER_HORIZONTAL_PADDING * 2);
  if (headerContentWidth === 0) {
    return { width: 0, height: 0 };
  }

  const width = Math.min(HIGHLIGHT_CARD_MAX_WIDTH, headerContentWidth * HIGHLIGHT_CARD_WIDTH_RATIO);
  return {
    width,
    height: width / HIGHLIGHT_CARD_ASPECT_RATIO,
  };
}

function MetricLine({
  label,
  minutes,
  style,
}: {
  label: string;
  minutes: number;
  style?: StyleProp<ViewStyle>;
}) {
  const parts = splitMinutes(minutes);
  return (
    <View style={[styles.metricLine, style]}>
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

function HighlightCard({
  summary,
  style,
}: {
  summary: DailyReportSummary;
  style?: StyleProp<ViewStyle>;
}) {
  const total = splitMinutes(summary.total_study_minutes);
  return (
    <ImageBackground
      source={HIGHLIGHT_BACKGROUND}
      resizeMode="stretch"
      style={[styles.highlightCard, style]}
      imageStyle={styles.highlightBackground}
      testID="stats-highlight-card"
    >
      <View pointerEvents="none" style={styles.sessionBadge} testID="stats-session-badge">
        <View style={styles.sessionBadgeTextRow}>
          <View style={styles.sessionBadgeXOffset}>
            <Text style={[styles.sessionBadgeText, styles.sessionBadgeXText]}>×</Text>
          </View>
          <SizableText style={[styles.sessionBadgeText, styles.sessionBadgeNumberText]}>
            {summary.total_sessions}
          </SizableText>
        </View>
      </View>
      <View style={styles.highlightContent}>
        <SizableText style={styles.highlightCaption}>勉強時間合計</SizableText>
        <View style={styles.totalTimeRow}>
          <SizableText style={[styles.totalTimeNumber, styles.totalTimeHoursSegment]}>
            {total.hours}
          </SizableText>
          <SizableText style={[styles.totalTimeUnit, styles.totalTimeHoursSegment]}>
            時間
          </SizableText>
          <SizableText style={[styles.totalTimeNumber, styles.totalTimeMinutesNumber]}>
            {total.minutes}
          </SizableText>
          <SizableText style={styles.totalTimeUnit}>分</SizableText>
        </View>

        <View style={styles.highlightBody}>
          <View style={styles.highlightMetrics}>
            <MetricLine label="インプット" minutes={summary.input_minutes} />
            <MetricLine
              label="アウトプット"
              minutes={summary.output_minutes}
              style={styles.lowerMetricLine}
            />
            <View style={[styles.breakPill, styles.lowerBreakPill]}>
              <SizableText style={styles.breakPillText}>休憩{summary.break_minutes}分</SizableText>
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

function HighlightPlaceholder({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[styles.highlightCard, style, styles.highlightPlaceholder]}
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
  onDatePress,
}: {
  monthStart: string;
  reports: WeeklyReportResponse[];
  onMonthChange: (monthStart: string) => void;
  onDatePress: (dateKey: string) => void;
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
            <SizableText style={styles.calendarWeekdayText} testID={`month-weekday-${weekday}`}>
              {weekday}
            </SizableText>
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
        <View style={styles.monthCalendarGrid} testID="month-calendar-grid">
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
                  <Pressable
                    accessibilityLabel={`${getMonthDayLabel(dateKey)}のサマリーを表示`}
                    accessibilityRole="button"
                    key={dateKey}
                    onPress={() => onDatePress(dateKey)}
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
                        testID={`month-day-${dateKey}-text`}
                      >
                        {getDateNumberLabel(dateKey)}
                      </SizableText>
                    </View>
                  </Pressable>
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
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, '');
  return `${label}h`;
}

function WeeklyBarChart({
  dateKeys,
  points,
  barSegmentsByDateKey,
}: {
  dateKeys: string[];
  points: WeeklyReportPoint[];
  barSegmentsByDateKey?: Readonly<Record<string, readonly WeeklyBarSegment[]>>;
}) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(
    0,
    width -
      WEEK_DATE_STRIP_HORIZONTAL_INSET * 2 +
      DAILY_WEEKLY_CALENDAR_STRIP_HORIZONTAL_OUTSET * 2 +
      WEEK_DATE_STRIP_HORIZONTAL_OUTSET * 2,
  );
  const plotLeft = WEEK_DATE_STRIP_LAYOUT_GUTTER_WIDTH;
  const plotWidth = Math.max(0, chartWidth - WEEK_DATE_STRIP_LAYOUT_GUTTER_WIDTH * 2);
  const axisY = WEEKLY_CHART_AXIS_Y;
  const chartSvgHeight = WEEKLY_CHART_HEIGHT + WEEKLY_CHART_TOP_OVERFLOW;
  const toSvgY = (y: number) => y + WEEKLY_CHART_TOP_OVERFLOW;
  const dayCellWidth = Math.min(WEEK_DATE_STRIP_DAY_CELL_MAX_WIDTH, plotWidth / 7);
  const dayStep = plotWidth > 0 ? (plotWidth - dayCellWidth) / 6 : 0;
  const barWidth = Math.min(34, Math.max(16, dayCellWidth * 0.76));
  const chartPoints = useMemo(() => {
    const pointsByDateKey = new Map(points.map((point) => [point.bucket, point]));
    return dateKeys.map(
      (dateKey) =>
        pointsByDateKey.get(dateKey) ?? {
          bucket: dateKey,
          label: getDateNumberLabel(dateKey),
          study_minutes: 0,
          sessions: 0,
        },
    );
  }, [dateKeys, points]);
  const maxStudyMinutes = Math.max(...chartPoints.map((point) => point.study_minutes), 0);
  const maxHours = maxStudyMinutes / 60;
  const stepValue = maxHours <= 1 ? 0.2 : Math.max(1, Math.ceil(maxHours / WEEKLY_CHART_SECTIONS));
  const yAxisMax = stepValue * WEEKLY_CHART_SECTIONS;
  const yAxisLabelTexts = useMemo(
    () =>
      Array.from({ length: WEEKLY_CHART_SECTIONS + 1 }, (_value, index) =>
        formatHourLabel(stepValue * index),
      ),
    [stepValue],
  );

  return (
    <View style={styles.weeklyChartWrap} testID="stats-weekly-chart">
      <View style={[styles.weeklyChartSvgFrame, { width: chartWidth }]}>
        <Svg width={chartWidth} height={chartSvgHeight} style={styles.weeklyChartSvg}>
          {yAxisLabelTexts.map((label, index) => {
            const y = axisY - (WEEKLY_CHART_PLOT_HEIGHT * index) / WEEKLY_CHART_SECTIONS;
            const labelY = y + 4;
            return (
              <G key={`rule-${index}`}>
                <Line
                  x1={plotLeft}
                  y1={toSvgY(y)}
                  x2={plotLeft + plotWidth}
                  y2={toSvgY(y)}
                  stroke="#E8E8E8"
                  strokeOpacity={1}
                  strokeWidth={1}
                />
                {label ? (
                  <SvgText
                    x={plotLeft - 8}
                    y={toSvgY(labelY)}
                    fill="#9D9D9D"
                    fontFamily="HiraginoSans-W6"
                    fontSize={10}
                    fontWeight="600"
                    textAnchor="end"
                  >
                    {label}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          {chartPoints.map((_point, index) => {
            const x = plotLeft + dayCellWidth / 2 + dayStep * index;
            return (
              <Line
                key={`vertical-${_point.bucket}`}
                x1={x}
                y1={toSvgY(WEEKLY_CHART_GRID_TOP)}
                x2={x}
                y2={toSvgY(axisY)}
                stroke="#F6F6F6"
                strokeOpacity={1}
                strokeWidth={1}
              />
            );
          })}
          {chartPoints.map((point, index) => {
            const value = point.study_minutes / 60;
            const barHeight = yAxisMax > 0 ? (value / yAxisMax) * WEEKLY_CHART_PLOT_HEIGHT : 0;
            const x = plotLeft + dayCellWidth / 2 + dayStep * index - barWidth / 2;
            const y = axisY - barHeight;
            const barClipPathId = `weekly-chart-bar-clip-${point.bucket}`;
            const segments = barSegmentsByDateKey?.[point.bucket] ?? [];
            let cumulativeMinutes = 0;
            const visibleSegments = segments.flatMap((segment) => {
              const remainingMinutes = Math.max(0, point.study_minutes - cumulativeMinutes);
              const minutes = Math.min(segment.minutes, remainingMinutes);
              if (minutes <= 0) return [];

              cumulativeMinutes += minutes;
              const color = segment.color;
              if (color === null) return [];

              return [{ ...segment, color, minutes, cumulativeMinutes }];
            });

            return (
              <G key={point.bucket}>
                <Defs>
                  <ClipPath id={barClipPathId}>
                    <Rect x={x} y={toSvgY(y)} width={barWidth} height={barHeight} rx={4} ry={4} />
                  </ClipPath>
                </Defs>
                <G clipPath={`url(#${barClipPathId})`}>
                  <Rect
                    x={x}
                    y={toSvgY(y)}
                    width={barWidth}
                    height={barHeight}
                    rx={4}
                    ry={4}
                    fill="#D6D6D6"
                    testID={`stats-weekly-chart-bar-${point.bucket}`}
                  />
                  {visibleSegments.map((segment) => {
                    const segmentHeight =
                      yAxisMax > 0
                        ? (segment.minutes / 60 / yAxisMax) * WEEKLY_CHART_PLOT_HEIGHT
                        : 0;
                    const segmentY =
                      axisY -
                      (yAxisMax > 0
                        ? (segment.cumulativeMinutes / 60 / yAxisMax) * WEEKLY_CHART_PLOT_HEIGHT
                        : 0);

                    return (
                      <Rect
                        key={segment.outputId}
                        x={x}
                        y={toSvgY(segmentY)}
                        width={barWidth}
                        height={segmentHeight}
                        clipPath={`url(#${barClipPathId})`}
                        fill={segment.color}
                        testID={`stats-weekly-chart-bar-segment-${point.bucket}-${segment.outputId}`}
                      />
                    );
                  })}
                </G>
              </G>
            );
          })}
          <Line
            x1={plotLeft}
            y1={toSvgY(axisY)}
            x2={plotLeft + plotWidth}
            y2={toSvgY(axisY)}
            stroke="#E8E8E8"
            strokeOpacity={1}
            strokeWidth={1}
          />
        </Svg>
      </View>
    </View>
  );
}

function NewSubjectFormModal({
  visible,
  subjectName,
  color,
  onChangeSubjectName,
  onChangeColor,
  onClose,
  onSave,
}: {
  visible: boolean;
  subjectName: string;
  color: string | null;
  onChangeSubjectName: (value: string) => void;
  onChangeColor: (value: string | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [isColorPickerVisible, setColorPickerVisible] = useState(false);
  const [draftColor, setDraftColor] = useState<string | null>(color);

  useEffect(() => {
    if (visible) {
      setColorPickerVisible(false);
      setDraftColor(color);
    }
  }, [color, visible]);

  if (!visible) return null;

  return (
    <View style={styles.newSubjectOverlay} testID="stats-new-subject-modal">
      <SafeAreaView style={styles.newSubjectRoot}>
        <View style={styles.newSubjectHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="戻る"
            hitSlop={8}
            onPress={onClose}
            style={styles.newSubjectBackButton}
            testID="stats-new-subject-back"
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 5 L8 12 L15 19"
                stroke="#333333"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <Text style={styles.newSubjectTitle} testID="stats-new-subject-title">
            教科を追加
          </Text>
        </View>

        <View style={styles.newSubjectForm}>
          <View style={styles.newSubjectRow}>
            <SizableText
              style={[styles.newSubjectLabel, styles.newSubjectSubjectLabel]}
              testID="stats-new-subject-subject-label"
            >
              教科
            </SizableText>
            <TextInput
              value={subjectName}
              onChangeText={onChangeSubjectName}
              placeholder="新規教科"
              placeholderTextColor="#D0D0D0"
              style={styles.newSubjectInput}
              testID="stats-new-subject-input"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setDraftColor(color);
              setColorPickerVisible(true);
            }}
            style={[styles.newSubjectRow, styles.newSubjectColorRow]}
            testID="stats-new-subject-color-row"
          >
            <SizableText style={styles.newSubjectLabel} testID="stats-new-subject-color-label">
              色
            </SizableText>
            <View
              style={[
                styles.newSubjectColorPreview,
                color !== null ? { backgroundColor: color } : null,
              ]}
              testID="stats-new-subject-color"
            />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onSave}
          style={[styles.newSubjectSaveButton, isColorPickerVisible ? styles.hidden : null]}
          testID="stats-new-subject-save"
        >
          <SizableText style={styles.newSubjectSaveText}>保存する</SizableText>
        </Pressable>

        {isColorPickerVisible ? (
          <View style={styles.colorPickerSheet} testID="stats-subject-color-picker">
            <View style={styles.colorPickerHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="色の選択を閉じる"
                hitSlop={8}
                onPress={() => setColorPickerVisible(false)}
                style={styles.colorPickerCloseButton}
                testID="stats-subject-color-picker-close"
              >
                <SizableText
                  style={styles.colorPickerCloseText}
                  testID="stats-subject-color-picker-close-text"
                >
                  ×
                </SizableText>
              </Pressable>
              <Text style={styles.colorPickerTitle} testID="stats-subject-color-picker-title">
                色の選択
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="色を決定"
                hitSlop={8}
                onPress={() => {
                  onChangeColor(draftColor);
                  setColorPickerVisible(false);
                }}
                style={styles.colorPickerConfirmButton}
                testID="stats-subject-color-picker-confirm"
              >
                <CheckIcon size={20} testID="stats-subject-color-picker-check-icon" />
              </Pressable>
            </View>
            <View style={styles.colorPickerGrid} testID="stats-subject-color-grid">
              {SUBJECT_COLOR_PICKER_ROWS.map((rowColors, rowIndex) => (
                <View
                  key={rowColors.join('-')}
                  style={styles.colorPickerRow}
                  testID={`stats-subject-color-row-${rowIndex}`}
                >
                  {rowColors.map((paletteColor, columnIndex) => {
                    const index = rowIndex * SUBJECT_COLOR_PICKER_COLUMN_COUNT + columnIndex;

                    return (
                      <Pressable
                        key={paletteColor}
                        accessibilityRole="button"
                        accessibilityLabel={`色${index + 1}`}
                        onPress={() =>
                          setDraftColor((currentColor) =>
                            currentColor === paletteColor ? null : paletteColor,
                          )
                        }
                        style={[styles.colorPickerSwatch, { backgroundColor: paletteColor }]}
                        testID={`stats-subject-color-swatch-${index}`}
                      >
                        {draftColor === paletteColor ? (
                          <Image
                            source={COLOR_PICKER_CHECK_ICON}
                            style={styles.colorPickerSwatchCheck}
                            testID={`stats-subject-color-swatch-check-${index}`}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function HistoryDetailSheet({
  item,
  onClose,
  subjectOptions,
  selectedSubject,
  onSelectSubject,
}: {
  item: OutputReviewItem | null;
  onClose: () => void;
  subjectOptions: SubjectOption[];
  selectedSubject: SubjectOption | null;
  onSelectSubject: (outputId: string, subject: SubjectOption) => void;
}) {
  const [isSubjectPickerVisible, setSubjectPickerVisible] = useState(false);
  const [isNewSubjectFormVisible, setNewSubjectFormVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState<string | null>(null);
  const [localSubjectOptions, setLocalSubjectOptions] = useState<SubjectOption[]>([]);

  useEffect(() => {
    setSubjectPickerVisible(false);
    setNewSubjectFormVisible(false);
  }, [item?.output.id]);

  if (item === null) return null;

  const timeRange = getHistoryTimeRangeParts(item);
  const titleDate = getTokyoMonthDayLabelFromTimestamp(item.output.submitted_at);
  const titleTimeRange = `${timeRange.start} - ${timeRange.end}`;
  const visibleSubjectOptions = [...subjectOptions];
  localSubjectOptions.forEach((subject) => {
    if (!visibleSubjectOptions.some((option) => option.label === subject.label)) {
      visibleSubjectOptions.push(subject);
    }
  });
  appendSubjectOptionIfMissing(visibleSubjectOptions, selectedSubject);
  const itemSubjectLabel = getSubjectLabel(item.subject);
  const itemSubjectOption =
    visibleSubjectOptions.find((subject) => subject.label === itemSubjectLabel) ?? null;
  const currentSubject = selectedSubject ?? itemSubjectOption;
  const subjectLabel = currentSubject?.label ?? itemSubjectLabel;
  const subjectColor = currentSubject?.color ?? null;
  const isSubjectUnset = currentSubject === null && isUnsetSubject(item.subject);
  const subjectPickerHeight = getSubjectPickerHeight(visibleSubjectOptions.length);
  const shouldScrollSubjectPicker = visibleSubjectOptions.length > SUBJECT_PICKER_MAX_VISIBLE_ITEMS;
  const handleOpenNewSubjectForm = () => {
    setNewSubjectName('');
    setNewSubjectColor(null);
    setSubjectPickerVisible(false);
    setNewSubjectFormVisible(true);
  };
  const handleSaveNewSubject = () => {
    const label = newSubjectName.trim();
    const existingSubject = visibleSubjectOptions.find((subject) => subject.label === label);
    const subjectToSelect =
      existingSubject ??
      (label.length > 0 ? { label, color: newSubjectColor ?? UNSELECTED_SUBJECT_COLOR } : null);

    if (subjectToSelect !== null && existingSubject === undefined) {
      setLocalSubjectOptions((current) => {
        const next = [...current];
        visibleSubjectOptions.forEach((subject) => {
          appendSubjectOptionIfMissing(next, subject);
        });
        appendSubjectOptionIfMissing(next, subjectToSelect);
        return next;
      });
    }
    if (subjectToSelect !== null) {
      onSelectSubject(item.output.id, subjectToSelect);
    }
    setNewSubjectFormVisible(false);
    setSubjectPickerVisible(true);
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible
      onRequestClose={onClose}
      testID="stats-history-sheet-modal"
    >
      <View style={styles.historySheetModalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="履歴詳細を閉じる"
          onPress={onClose}
          style={styles.historySheetBackdrop}
          testID="stats-history-sheet-backdrop"
        />
        <View
          accessibilityViewIsModal
          style={styles.historySheetPanel}
          testID="stats-history-sheet"
        >
          <View style={styles.historySheetHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="閉じる"
              hitSlop={8}
              onPress={onClose}
              style={styles.historySheetIconButton}
              testID="stats-history-sheet-close"
            >
              <CloseIcon size={17} testID="stats-history-sheet-close-icon" />
            </Pressable>
            <SizableText
              style={styles.historySheetTitle}
              numberOfLines={1}
              testID="stats-history-sheet-title"
            >
              {titleDate}
              {'　'}
              <Text style={styles.historySheetTitleTime} testID="stats-history-sheet-title-time">
                {titleTimeRange}
              </Text>
            </SizableText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="閉じる"
              hitSlop={8}
              onPress={onClose}
              style={[styles.historySheetIconButton, styles.historySheetConfirmButton]}
              testID="stats-history-sheet-confirm"
            >
              <CheckIcon size={17} testID="stats-history-sheet-confirm-icon" />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isSubjectPickerVisible }}
            onPress={() => setSubjectPickerVisible(true)}
            style={styles.historySheetSubjectRow}
            testID="stats-history-sheet-subject-row"
          >
            <SizableText style={styles.historySheetLabel}>教科</SizableText>
            <View style={styles.historySheetSubjectValue}>
              <View
                style={[
                  styles.historySheetSubjectDot,
                  subjectColor !== null ? { backgroundColor: subjectColor } : null,
                  isSubjectUnset ? styles.historySheetSubjectDotUnset : null,
                ]}
                testID="stats-history-sheet-subject-dot"
              />
              <SizableText
                style={[
                  styles.historySheetSubjectText,
                  isSubjectUnset ? styles.historySheetSubjectTextUnset : null,
                ]}
                numberOfLines={1}
                testID="stats-history-sheet-subject-text"
              >
                {subjectLabel}
              </SizableText>
            </View>
          </Pressable>
          <View style={styles.historySheetDivider} />

          {isSubjectPickerVisible ? (
            <View
              style={[styles.historySheetSubjectPicker, { height: subjectPickerHeight }]}
              testID="stats-history-sheet-subject-picker"
            >
              <View style={styles.historySheetSubjectPickerHeader}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleOpenNewSubjectForm}
                  style={styles.historySheetNewSubjectButton}
                  testID="stats-history-sheet-subject-picker-new"
                >
                  <Image
                    source={PLUS_ICON}
                    style={styles.historySheetNewSubjectIcon}
                    testID="stats-history-sheet-new-subject-plus-icon"
                  />
                  <SizableText style={styles.historySheetNewSubjectText}>
                    教科を追加する
                  </SizableText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="教科一覧を閉じる"
                  hitSlop={8}
                  onPress={() => setSubjectPickerVisible(false)}
                  style={styles.historySheetSubjectPickerClose}
                  testID="stats-history-sheet-subject-picker-close"
                >
                  <SizableText style={styles.historySheetSubjectPickerCloseText}>×</SizableText>
                </Pressable>
              </View>
              {visibleSubjectOptions.length > 0 ? (
                <ScrollView
                  style={styles.historySheetSubjectPickerScroll}
                  contentContainerStyle={styles.historySheetSubjectPickerList}
                  showsVerticalScrollIndicator={shouldScrollSubjectPicker}
                >
                  {visibleSubjectOptions.map((subject, index) => {
                    const isSelectedSubject = currentSubject?.label === subject.label;

                    return (
                      <Pressable
                        key={subject.label}
                        accessibilityRole="button"
                        onPress={() => {
                          onSelectSubject(item.output.id, subject);
                          setSubjectPickerVisible(false);
                        }}
                        style={styles.historySheetSubjectPickerItem}
                        testID={`stats-history-sheet-subject-option-${index}`}
                      >
                        <View
                          style={[
                            styles.historySheetSubjectPickerDot,
                            { backgroundColor: subject.color },
                          ]}
                          testID={`stats-history-sheet-subject-option-dot-${index}`}
                        />
                        <SizableText style={styles.historySheetSubjectPickerText}>
                          {subject.label}
                        </SizableText>
                        {isSelectedSubject ? (
                          <Image
                            source={COLOR_PICKER_CHECK_ICON}
                            style={styles.historySheetSubjectPickerCheck}
                            testID={`stats-history-sheet-subject-option-check-${index}`}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          <SizableText style={styles.historySheetSectionTitle}>アウトプット</SizableText>
          <View style={styles.historySheetOutputFrame}>
            <HistoryOutputModeTabs activeKind={item.output.kind} />
            <View style={styles.historySheetOutputBody}>
              <HistorySheetOutput item={item} />
            </View>
          </View>
        </View>
        <NewSubjectFormModal
          visible={isNewSubjectFormVisible}
          subjectName={newSubjectName}
          color={newSubjectColor}
          onChangeSubjectName={setNewSubjectName}
          onChangeColor={setNewSubjectColor}
          onClose={() => setNewSubjectFormVisible(false)}
          onSave={handleSaveNewSubject}
        />
      </View>
    </Modal>
  );
}

function HistoryOutputModeTabs({ activeKind }: { activeKind: OutputReviewItem['output']['kind'] }) {
  return (
    <View style={styles.historySheetTabs}>
      {HISTORY_OUTPUT_MODE_TABS.map((tab) => {
        const isActive = tab.key === activeKind;
        return (
          <View
            key={tab.key}
            style={[styles.historySheetTab, isActive ? styles.historySheetTabActive : null]}
          >
            <Image
              source={isActive ? tab.activeIcon : tab.inactiveIcon}
              resizeMode="contain"
              style={styles.historySheetTabIcon}
              testID={`stats-history-sheet-tab-icon-${tab.key}`}
            />
            <SizableText
              style={[
                styles.historySheetTabText,
                isActive ? styles.historySheetTabTextActive : null,
              ]}
              testID={`stats-history-sheet-tab-label-${tab.key}`}
            >
              {tab.label}
            </SizableText>
          </View>
        );
      })}
    </View>
  );
}

function HistorySheetOutput({ item }: { item: OutputReviewItem }) {
  if (item.output.kind === 'image') {
    if (item.output.image_url === null) {
      return (
        <View style={styles.historySheetEmptyOutput}>
          <SizableText style={styles.historySheetEmptyOutputText}>
            画像アウトプットがありません。
          </SizableText>
        </View>
      );
    }

    return (
      <Image
        source={{ uri: item.output.image_url }}
        resizeMode="contain"
        style={styles.historySheetOutputImage}
        testID="stats-history-sheet-output-image"
      />
    );
  }

  const content = item.output.content?.trim();
  if (!content) {
    return (
      <View style={styles.historySheetEmptyOutput}>
        <SizableText style={styles.historySheetEmptyOutputText}>
          テキストアウトプットがありません。
        </SizableText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.historySheetOutputScroll}
      contentContainerStyle={styles.historySheetOutputScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <AnnotatedOutputText
        content={content}
        corrections={item.judgment?.corrections ?? []}
        selectedCorrectionIndex={null}
        onSelectCorrection={() => undefined}
        textStyle={styles.historySheetOutputText}
        testID="stats-history-sheet-output-text"
      />
    </ScrollView>
  );
}

function OutputHistory({
  items,
  fallbackDateKey,
  emptyMessage = 'この日の履歴はまだありません。',
  titleFrameStyle,
  cardFrameStyle,
  titleScrolls = false,
  onSelectItem,
}: {
  items: OutputReviewItem[];
  fallbackDateKey?: string;
  emptyMessage?: string;
  titleFrameStyle?: StyleProp<TextStyle>;
  cardFrameStyle?: StyleProp<ViewStyle>;
  titleScrolls?: boolean;
  onSelectItem: (item: OutputReviewItem) => void;
}) {
  const groups = useMemo(
    () => buildHistoryGroups(items, fallbackDateKey),
    [fallbackDateKey, items],
  );
  const title = (
    <SizableText style={[styles.historyTitle, titleFrameStyle]} testID="stats-output-history-title">
      履歴
    </SizableText>
  );

  return (
    <View
      style={[styles.historySection, titleScrolls ? null : styles.historySectionFixedTitle]}
      testID="stats-output-history"
    >
      {titleScrolls ? null : title}
      <ScrollView
        style={styles.historyTableScroll}
        contentContainerStyle={[
          styles.historyTableScrollContent,
          titleScrolls ? styles.historyTableScrollContentWithTitle : null,
        ]}
        showsVerticalScrollIndicator={false}
        testID="stats-output-history-table-scroll"
      >
        {titleScrolls ? title : null}
        <View style={styles.historyTableList}>
          {groups.map((group) => (
            <View key={group.dateKey} style={[styles.historyCard, cardFrameStyle]}>
              {group.dateLabel ? (
                <SizableText style={styles.historyDateText}>{group.dateLabel}</SizableText>
              ) : null}
              {group.items.length === 0 ? (
                <View style={styles.emptyHistory} testID="stats-output-history-empty">
                  <SizableText style={styles.emptyHistoryText}>{emptyMessage}</SizableText>
                </View>
              ) : (
                group.items.map((item, index) => {
                  const timeRange = getHistoryTimeRangeParts(item);
                  const timeRangeLabel = `${timeRange.start}  -  ${timeRange.end}`;
                  const isLastRow = index === group.items.length - 1;
                  return (
                    <Pressable
                      key={item.output.id}
                      accessibilityRole="button"
                      onPress={() => onSelectItem(item)}
                      style={[styles.historyRow, !isLastRow ? styles.historyRowBorder : null]}
                      testID={`stats-output-history-item-${item.output.id}`}
                    >
                      <View style={styles.historyTimeRange}>
                        <Text
                          adjustsFontSizeToFit
                          minimumFontScale={0.82}
                          numberOfLines={1}
                          style={[
                            styles.historyTimeText,
                            !isLastRow ? styles.historyTimeTextUpperRows : null,
                            isLastRow ? styles.historyTimeTextLastRow : null,
                          ]}
                        >
                          {timeRangeLabel}
                        </Text>
                      </View>
                      <SizableText style={styles.historyCycleText} numberOfLines={1}>
                        サイクル{item.cycle_index}
                      </SizableText>
                    </Pressable>
                  );
                })
              )}
            </View>
          ))}
        </View>
      </ScrollView>
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
  const router = useRouter();
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const queryClient = useQueryClient();
  const { width: viewportWidth } = useWindowDimensions();
  const todayKey = getTokyoDateKey();
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayKey);
  const weekStart = useMemo(
    () => getSundayWeekStartKey(parseDateKey(selectedDateKey)),
    [selectedDateKey],
  );
  const [reportViewMode, setReportViewMode] = useState<ReportViewMode>('daily');
  const [calendarMonthStart, setCalendarMonthStart] = useState(() => getMonthStartKey(weekStart));
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<OutputReviewItem | null>(null);
  const [selectedSubjectByOutputId, setSelectedSubjectByOutputId] = useState<
    Record<string, SubjectOption>
  >({});
  const updateSubjectMutation = useMutation({
    mutationFn: ({ outputId, subject }: { outputId: string; subject: SubjectOption }) =>
      updateOutputSubject(outputId, { label: subject.label, color: subject.color }),
    onSuccess: (assignment) => {
      const savedSubject = {
        label: assignment.subject,
        color: assignment.subject_color,
      };
      setSelectedSubjectByOutputId((current) => ({
        ...current,
        [assignment.output_id]: savedSubject,
      }));
      queryClient.setQueriesData({ queryKey: ['stats'] }, (report) =>
        applyOutputSubjectToReportCache(
          report,
          assignment.output_id,
          savedSubject,
          assignment.subject_id,
        ),
      );
    },
    onError: (_error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      setSelectedSubjectByOutputId((current) => {
        if (current[variables.outputId] !== variables.subject) return current;

        const next = { ...current };
        delete next[variables.outputId];
        return next;
      });
    },
  });
  const dailyReportQuery = useDailyReport(selectedDateKey);
  const weeklyReportQuery = useWeeklyReport(weekStart, {
    enabled: reportViewMode !== 'monthly',
  });
  const monthlyReports = useMonthlyWeeklyReports(calendarMonthStart, reportViewMode === 'monthly');
  const calendarStudiedDateKeys = useMemo(() => {
    const dateKeys = new Set<string>();

    weeklyReportQuery.data?.points.forEach((point) => {
      if (point.study_minutes > 0) {
        dateKeys.add(point.bucket);
      }
    });

    if (dailyReportQuery.data && dailyReportQuery.data.summary.total_study_minutes > 0) {
      dateKeys.add(dailyReportQuery.data.date);
    }

    return Array.from(dateKeys);
  }, [dailyReportQuery.data, weeklyReportQuery.data]);
  const loadedHistoryItems = useMemo(
    () => [
      ...(dailyReportQuery.data?.output_history ?? []),
      ...(weeklyReportQuery.data?.output_history ?? []),
      ...monthlyReports.reports.flatMap((report) => report.output_history),
    ],
    [
      dailyReportQuery.data?.output_history,
      monthlyReports.reports,
      weeklyReportQuery.data?.output_history,
    ],
  );
  const subjectOptions = useMemo(() => {
    const options = buildSubjectOptions(loadedHistoryItems);
    Object.values(selectedSubjectByOutputId).forEach((subject) => {
      appendSubjectOptionIfMissing(options, subject);
    });
    return options;
  }, [loadedHistoryItems, selectedSubjectByOutputId]);
  const weeklyBarSegmentsByDateKey = useMemo(() => {
    if (weeklyReportQuery.data === undefined) return {};

    return buildWeeklyBarSegmentsByDateKey(
      weeklyReportQuery.data.output_history,
      subjectOptions,
      selectedSubjectByOutputId,
    );
  }, [selectedSubjectByOutputId, subjectOptions, weeklyReportQuery.data]);
  const weeklyChartDateKeys = useMemo(
    () => getCenteredDateKeys(selectedDateKey),
    [selectedDateKey],
  );
  const highlightCardSize = useMemo(() => getHighlightCardSize(viewportWidth), [viewportWidth]);
  const dailyHighlightCardStyle = useMemo<StyleProp<ViewStyle>>(() => {
    if (highlightCardSize.height === 0) return undefined;

    const height = Math.max(0, highlightCardSize.height - DAILY_HIGHLIGHT_CARD_HEIGHT_REDUCTION);
    return {
      width: height * HIGHLIGHT_CARD_ASPECT_RATIO + DAILY_HIGHLIGHT_CARD_EXTRA_WIDTH,
      height: height + DAILY_HIGHLIGHT_CARD_EXTRA_HEIGHT,
    };
  }, [highlightCardSize.height]);
  const dailyHighlightViewFrameStyle = useMemo<StyleProp<ViewStyle>>(() => {
    if (highlightCardSize.height === 0) return undefined;

    const height = Math.max(0, highlightCardSize.height - DAILY_HIGHLIGHT_CARD_HEIGHT_REDUCTION);
    return {
      width: height * HIGHLIGHT_CARD_ASPECT_RATIO,
      alignSelf: 'center',
      marginLeft: 0,
    };
  }, [highlightCardSize.height]);
  const dailyHighlightTextFrameStyle = useMemo<StyleProp<TextStyle>>(() => {
    if (highlightCardSize.height === 0) return undefined;

    const height = Math.max(0, highlightCardSize.height - DAILY_HIGHLIGHT_CARD_HEIGHT_REDUCTION);
    return {
      width: height * HIGHLIGHT_CARD_ASPECT_RATIO,
      alignSelf: 'center',
      marginLeft: 0,
    };
  }, [highlightCardSize.height]);
  const weeklyChartSlotHistoryOffset = useMemo(() => {
    if (highlightCardSize.height === 0) return 0;

    const highlightCardHeight = highlightCardSize.height;
    const weeklyChartSlotHeight = Math.max(highlightCardHeight, WEEKLY_CHART_SLOT_MIN_HEIGHT);
    return (
      highlightCardHeight +
      FIXED_HEADER_BOTTOM_PADDING +
      SCROLL_BOUNDARY_HEIGHT -
      weeklyChartSlotHeight +
      WEEKLY_HISTORY_UP_OFFSET +
      DAILY_HIGHLIGHT_CARD_EXTRA_HEIGHT
    );
  }, [highlightCardSize.height]);
  const weeklyChartSlotStyle = useMemo(
    () => [styles.weeklyChartSlot, { marginBottom: weeklyChartSlotHistoryOffset }],
    [weeklyChartSlotHistoryOffset],
  );
  const handleDailyRetry = useCallback(() => {
    void dailyReportQuery.refetch();
  }, [dailyReportQuery]);
  const handleWeeklyRetry = useCallback(() => {
    void weeklyReportQuery.refetch();
  }, [weeklyReportQuery]);
  const handleMonthlyRetry = useCallback(() => {
    monthlyReports.refetch();
  }, [monthlyReports]);
  const handleOpenHistorySheet = useCallback((item: OutputReviewItem) => {
    setSelectedHistoryItem(item);
  }, []);
  const handleCloseHistorySheet = useCallback(() => {
    setSelectedHistoryItem(null);
  }, []);
  const handleSelectHistorySubject = useCallback(
    (outputId: string, subject: SubjectOption) => {
      setSelectedSubjectByOutputId((current) => {
        const currentSubject = current[outputId];
        if (currentSubject?.label === subject.label && currentSubject.color === subject.color) {
          return current;
        }

        return {
          ...current,
          [outputId]: subject,
        };
      });
      updateSubjectMutation.mutate({ outputId, subject });
    },
    [updateSubjectMutation],
  );
  const handleOpenMonthlyCalendar = useCallback(() => {
    setCalendarMonthStart(getMonthStartKey(weekStart));
    setReportViewMode('monthly');
  }, [weekStart]);
  const handleCloseMonthlyCalendar = useCallback(() => {
    setReportViewMode('daily');
  }, []);
  const handleSelectMonthlyDate = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
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
  const selectedHistorySubject =
    selectedHistoryItem === null
      ? null
      : (selectedSubjectByOutputId[selectedHistoryItem.output.id] ?? null);
  const settingsButton = (
    <SessionSettingsButton
      onPress={() => router.push(SETTINGS_ROUTE)}
      testID="stats-settings-button"
      rowStyle={styles.settingsButtonRow}
    />
  );

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
          onDatePress={handleSelectMonthlyDate}
        />
        <View style={styles.monthlyHighlightTitleRow}>
          <SizableText style={styles.highlightTitle}>今月のハイライト</SizableText>
          <ShareIconButton />
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
        <OutputHistory
          items={dailyReportQuery.data.output_history}
          fallbackDateKey={dailyReportQuery.data.date}
          titleFrameStyle={dailyHighlightTextFrameStyle}
          cardFrameStyle={dailyHighlightViewFrameStyle}
          onSelectItem={handleOpenHistorySheet}
        />
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
        <OutputHistory
          items={weeklyReportQuery.data.output_history}
          emptyMessage="この週の履歴はまだありません。"
          titleFrameStyle={dailyHighlightTextFrameStyle}
          cardFrameStyle={dailyHighlightViewFrameStyle}
          titleScrolls
          onSelectItem={handleOpenHistorySheet}
        />
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
        <View style={styles.container}>
          <ScrollView
            style={styles.monthlyScrollArea}
            contentContainerStyle={styles.monthlyContent}
            showsVerticalScrollIndicator={false}
            testID="stats-monthly-content"
          >
            <View style={styles.monthRow}>
              <SizableText style={styles.monthText}>
                {getMonthLabel(calendarMonthStart)}
              </SizableText>
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
          {settingsButton}
          <HistoryDetailSheet
            item={selectedHistoryItem}
            onClose={handleCloseHistorySheet}
            subjectOptions={subjectOptions}
            selectedSubject={selectedHistorySubject}
            onSelectSubject={handleSelectHistorySubject}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (reportViewMode === 'weekly') {
    return (
      <SafeAreaView style={styles.safeArea} testID="stats-root">
        <StatusBar style="dark" />
        <View style={styles.container}>
          <View style={[styles.fixedHeader, styles.weeklyFixedHeader]}>
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
            <View style={styles.dailyWeeklyCalendarStrip}>
              <WeekDateStrip
                weekStart={weekStart}
                onWeekChange={handleWeekChange}
                selectedDateKey={selectedDateKey}
                onSelectDate={handleSelectDate}
                studiedDateKeys={calendarStudiedDateKeys}
                showSelectedDateHighlight={false}
              />
            </View>
            <View style={styles.weeklyCalendarGraphBoundaryWrap}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
              >
                <View style={[styles.highlightTitleRow, styles.hiddenHighlightTitleRow]} />
              </View>
              <View
                pointerEvents="none"
                style={[styles.scrollBoundary, styles.weeklyCalendarGraphBoundary]}
                testID="stats-weekly-calendar-graph-boundary"
              />
            </View>
            {weeklyReportQuery.data ? (
              <View style={weeklyChartSlotStyle}>
                <WeeklyBarChart
                  dateKeys={weeklyChartDateKeys}
                  points={weeklyReportQuery.data.points}
                  barSegmentsByDateKey={weeklyBarSegmentsByDateKey}
                />
              </View>
            ) : (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={weeklyChartSlotStyle}
              />
            )}
          </View>
          {settingsButton}
          <View style={styles.historyPane} testID="stats-weekly-content">
            {weeklyBody}
          </View>
          <HistoryDetailSheet
            item={selectedHistoryItem}
            onClose={handleCloseHistorySheet}
            subjectOptions={subjectOptions}
            selectedSubject={selectedHistorySubject}
            onSelectSubject={handleSelectHistorySubject}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} testID="stats-root">
      <StatusBar style="dark" />
      <View style={styles.container}>
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
          <View style={styles.dailyWeeklyCalendarStrip}>
            <WeekDateStrip
              weekStart={weekStart}
              onWeekChange={handleWeekChange}
              selectedDateKey={selectedDateKey}
              onSelectDate={handleSelectDate}
              studiedDateKeys={calendarStudiedDateKeys}
            />
          </View>
          <View
            style={[
              styles.highlightTitleRow,
              styles.dailyHighlightTitleRow,
              dailyHighlightViewFrameStyle,
            ]}
            testID="stats-highlight-title-row"
          >
            <SizableText style={[styles.highlightTitle, styles.dailyHighlightTitle]}>
              {highlightTitle}
            </SizableText>
            <ShareIconButton />
          </View>
          {dailyReportQuery.data ? (
            <HighlightCard
              summary={dailyReportQuery.data.summary}
              style={[dailyHighlightCardStyle, styles.dailyHighlightCardOffset]}
            />
          ) : (
            <HighlightPlaceholder style={dailyHighlightCardStyle} />
          )}
        </View>
        <View style={[styles.scrollBoundary, styles.dailyScrollBoundary]} />
        <View style={styles.historyPane} testID="stats-scroll-content">
          {dailyBody}
        </View>
        {settingsButton}
        <HistoryDetailSheet
          item={selectedHistoryItem}
          onClose={handleCloseHistorySheet}
          subjectOptions={subjectOptions}
          selectedSubject={selectedHistorySubject}
          onSelectSubject={handleSelectHistorySubject}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  settingsButtonRow: {
    right: STATS_SETTINGS_BUTTON_RIGHT,
  },
  fixedHeader: {
    paddingHorizontal: FIXED_HEADER_HORIZONTAL_PADDING,
    paddingTop: 12,
    paddingBottom: FIXED_HEADER_BOTTOM_PADDING,
    backgroundColor: '#FFFFFF',
  },
  weeklyFixedHeader: {
    paddingBottom: 0,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 20,
    marginBottom: 2,
    transform: [{ translateY: -7 }],
  },
  calendarButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -5 }, { translateY: -1 }],
  },
  calendarToggleIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  dailyWeeklyCalendarStrip: {
    transform: [{ translateY: -4 }],
    marginHorizontal: -DAILY_WEEKLY_CALENDAR_STRIP_HORIZONTAL_OUTSET,
  },
  monthText: {
    color: '#333333',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 29,
  },
  weeklyCalendarGraphBoundaryWrap: {
    position: 'relative',
  },
  weeklyCalendarGraphBoundary: {
    position: 'absolute',
    left: -24,
    right: -24,
    bottom: WEEKLY_CALENDAR_GRAPH_BOUNDARY_BOTTOM,
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
    width: '100%',
    alignItems: 'stretch',
    marginTop: 18,
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    width: '100%',
  },
  calendarWeekdayCell: {
    flex: 1,
    minWidth: 0,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWeekdayText: {
    color: '#333333',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  monthCalendarGridWrap: {
    position: 'relative',
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 10,
  },
  monthCalendarGrid: {
    width: '100%',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    width: '100%',
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
    left: -MONTH_CALENDAR_ARROW_OUTSET,
  },
  monthCalendarArrowRight: {
    right: -MONTH_CALENDAR_ARROW_OUTSET,
  },
  monthDaySlot: {
    flex: 1,
    minWidth: 0,
    height: MONTH_DAY_SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MONTH_DAY_ROW_GAP,
  },
  monthDayMarker: {
    width: '100%',
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
    fontFamily: 'HiraginoSans-W6',
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
    width: '96%',
    maxWidth: 360,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  hiddenHighlightTitleRow: {
    height: 30,
  },
  dailyHighlightTitleRow: {
    transform: [{ translateY: DAILY_HIGHLIGHT_TITLE_ROW_TRANSLATE_Y }],
  },
  highlightTitle: {
    color: '#333333',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    paddingLeft: 9,
  },
  dailyHighlightTitle: {
    fontFamily: 'HiraginoSans-W6',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    paddingLeft: 0,
    transform: [{ translateX: DAILY_HIGHLIGHT_TITLE_TRANSLATE_X }],
  },
  shareButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  shareIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
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
    maxWidth: HIGHLIGHT_CARD_MAX_WIDTH,
    aspectRatio: HIGHLIGHT_CARD_ASPECT_RATIO,
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  highlightBackground: {},
  dailyHighlightCardOffset: {
    transform: [
      { translateX: DAILY_HIGHLIGHT_CARD_EXTRA_WIDTH / 2 },
      { translateY: DAILY_HIGHLIGHT_CARD_TRANSLATE_Y },
    ],
  },
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
    fontFamily: 'HiraginoSans-W6',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
    transform: [{ translateY: 1 }],
  },
  totalTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
    transform: [{ translateX: 2 }],
  },
  totalTimeNumber: {
    color: '#333333',
    fontFamily: 'HiraginoSans-W7',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  totalTimeHoursSegment: {
    transform: [{ translateX: 4 }],
  },
  totalTimeMinutesNumber: {
    marginLeft: 8,
  },
  totalTimeUnit: {
    color: '#333333',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 28,
    marginLeft: 2,
  },
  highlightBody: {
    alignItems: 'center',
    marginTop: 16,
  },
  highlightMetrics: {
    width: 166,
    alignSelf: 'flex-end',
    gap: 7,
    marginTop: 10,
    transform: [{ translateX: DAILY_HIGHLIGHT_METRICS_TRANSLATE_X }],
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
    fontFamily: 'HiraginoSans-W6',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  sessionBadgeTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
    transform: [{ translateY: -1 }],
  },
  sessionBadgeXOffset: {
    position: 'relative',
    left: -2,
    top: 0,
  },
  sessionBadgeXText: {
    fontSize: 14,
    lineHeight: 22,
  },
  sessionBadgeNumberText: {
    transform: [{ translateX: -2 }],
  },
  metricLine: {
    gap: 2,
  },
  lowerMetricLine: {
    marginTop: 4,
  },
  metricLabel: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    paddingLeft: 24,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: -36,
    transform: [{ translateY: -3 }],
  },
  metricConnector: {
    width: 54,
    height: 1,
    backgroundColor: '#333333',
    marginRight: 2,
    zIndex: 1,
    elevation: 1,
  },
  metricValue: {
    color: '#333333',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 31,
  },
  metricUnit: {
    color: '#333333',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 25,
    transform: [{ translateY: 5 }],
  },
  breakPill: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6D6D6',
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    marginLeft: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lowerBreakPill: {
    marginTop: 4,
    transform: [{ translateY: -10 }],
  },
  breakPillText: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  historySheetModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  historySheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  historySheetPanel: {
    width: '100%',
    maxWidth: 430,
    height: '67%',
    maxHeight: '69%',
    alignSelf: 'center',
    borderTopLeftRadius: HISTORY_SHEET_TOP_RADIUS,
    borderTopRightRadius: HISTORY_SHEET_TOP_RADIUS,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 31,
    paddingTop: 22,
    paddingBottom: 34,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  historySheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historySheetIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    transform: [{ translateY: 4 }],
  },
  historySheetConfirmButton: {
    backgroundColor: '#E6EAFF',
  },
  historySheetTitle: {
    flex: 1,
    paddingLeft: 12,
    color: '#111111',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
    transform: [{ translateY: 5 }],
  },
  historySheetTitleTime: {
    transform: [{ translateX: 3 }, { scaleX: 0.98 }],
  },
  historySheetSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 30,
    transform: [{ translateY: -3 }],
  },
  historySheetLabel: {
    color: '#363636',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  historySheetSubjectValue: {
    maxWidth: 170,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  historySheetSubjectDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#28D94F',
  },
  historySheetSubjectDotUnset: {
    backgroundColor: '#D0D0D0',
  },
  historySheetSubjectText: {
    flexShrink: 1,
    color: '#363636',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  historySheetSubjectTextUnset: {
    color: '#777777',
  },
  historySheetSubjectPicker: {
    position: 'absolute',
    top: 106,
    left: 45,
    right: 45,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 17,
    paddingBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 12,
  },
  historySheetSubjectPickerHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historySheetNewSubjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    transform: [{ translateY: 2 }],
  },
  historySheetNewSubjectIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  historySheetNewSubjectText: {
    color: '#8A8A8A',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 23,
  },
  historySheetSubjectPickerClose: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -9 }],
  },
  historySheetSubjectPickerCloseText: {
    color: '#777777',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    textShadowColor: '#777777',
    textShadowOffset: { width: 0.7, height: 0 },
    textShadowRadius: 0,
  },
  historySheetSubjectPickerScroll: {
    marginTop: 9,
    maxHeight:
      SUBJECT_PICKER_MAX_VISIBLE_ITEMS * SUBJECT_PICKER_ITEM_HEIGHT +
      (SUBJECT_PICKER_MAX_VISIBLE_ITEMS - 1) * SUBJECT_PICKER_ITEM_GAP +
      SUBJECT_PICKER_LIST_BOTTOM_PADDING,
  },
  historySheetSubjectPickerList: {
    gap: 6,
    paddingBottom: SUBJECT_PICKER_LIST_BOTTOM_PADDING,
  },
  historySheetSubjectPickerItem: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historySheetSubjectPickerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    transform: [{ translateY: 2 }],
  },
  historySheetSubjectPickerText: {
    flex: 1,
    color: '#333333',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 24,
    transform: [{ translateY: 2 }],
  },
  historySheetSubjectPickerCheck: {
    width: 18,
    height: 14,
    marginLeft: 'auto',
  },
  historySheetDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    marginTop: 7,
    backgroundColor: '#D0D0D0',
  },
  historySheetSectionTitle: {
    marginHorizontal: 12,
    marginTop: 13,
    color: '#333333',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    transform: [{ translateY: 2 }],
  },
  historySheetOutputFrame: {
    flex: 1,
    minHeight: 296,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#777777',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 17,
    backgroundColor: '#FFFFFF',
  },
  historySheetTabs: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 7,
    backgroundColor: '#EFEFEF',
    overflow: 'hidden',
    padding: 2,
    transform: [{ translateY: 4 }],
  },
  historySheetTab: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  historySheetTabActive: {
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
  },
  historySheetTabIcon: {
    width: 17,
    height: 17,
  },
  historySheetTabText: {
    color: '#777777',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  historySheetTabTextActive: {
    color: '#2F2F2F',
  },
  historySheetOutputBody: {
    flex: 1,
    minHeight: 234,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  historySheetOutputScroll: {
    flex: 1,
  },
  historySheetOutputScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  historySheetOutputText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 19,
  },
  historySheetOutputImage: {
    flex: 1,
    width: '100%',
  },
  historySheetEmptyOutput: {
    flex: 1,
    minHeight: 234,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  historySheetEmptyOutputText: {
    color: '#777777',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  newSubjectOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    borderTopLeftRadius: HISTORY_SHEET_TOP_RADIUS,
    borderTopRightRadius: HISTORY_SHEET_TOP_RADIUS,
    backgroundColor: '#FFFFFF',
    elevation: 40,
  },
  hidden: {
    display: 'none',
  },
  newSubjectRoot: {
    flex: 1,
    borderTopLeftRadius: HISTORY_SHEET_TOP_RADIUS,
    borderTopRightRadius: HISTORY_SHEET_TOP_RADIUS,
    backgroundColor: '#FFFFFF',
  },
  newSubjectHeader: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSubjectBackButton: {
    position: 'absolute',
    left: 30,
    top: 5,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSubjectTitle: {
    position: 'absolute',
    top: 9,
    left: 6,
    right: -6,
    color: '#111111',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
  },
  newSubjectForm: {
    paddingHorizontal: 33,
  },
  newSubjectRow: {
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D9D9D9',
  },
  newSubjectColorRow: {
    borderBottomWidth: 0,
  },
  newSubjectLabel: {
    width: 64,
    color: '#333333',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  newSubjectSubjectLabel: {
    fontSize: 17,
    lineHeight: 23,
    transform: [{ translateX: 12 }, { translateY: -2 }],
  },
  newSubjectInput: {
    flex: 1,
    height: 29,
    padding: 0,
    color: '#333333',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 23,
    textAlign: 'right',
    transform: [{ translateX: -12 }, { translateY: -3 }],
  },
  newSubjectColorPreview: {
    width: 14,
    height: 14,
    marginLeft: 'auto',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D0',
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  newSubjectSaveButton: {
    position: 'absolute',
    left: 39,
    right: 39,
    bottom: 56,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B5CFF',
  },
  newSubjectSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  colorPickerSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 418,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 44,
  },
  colorPickerHeader: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickerCloseButton: {
    position: 'absolute',
    left: 20,
    top: SUBJECT_COLOR_PICKER_HEADER_BUTTON_TOP,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
  },
  colorPickerCloseText: {
    color: '#333333',
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 30,
  },
  colorPickerTitle: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: SUBJECT_COLOR_PICKER_HEADER_TITLE_MARGIN_TOP,
  },
  colorPickerConfirmButton: {
    position: 'absolute',
    right: 20,
    top: SUBJECT_COLOR_PICKER_HEADER_BUTTON_TOP,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6EAFF',
  },
  colorPickerGrid: {
    alignItems: 'center',
    gap: SUBJECT_COLOR_PICKER_ROW_GAP,
    paddingHorizontal: SUBJECT_COLOR_PICKER_HORIZONTAL_PADDING,
    paddingTop: SUBJECT_COLOR_PICKER_TOP_PADDING,
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: SUBJECT_COLOR_PICKER_COLUMN_GAP,
  },
  colorPickerSwatch: {
    width: SUBJECT_COLOR_PICKER_SWATCH_SIZE,
    height: SUBJECT_COLOR_PICKER_SWATCH_SIZE,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickerSwatchCheck: {
    width: 24,
    height: 19,
  },
  scrollBoundary: {
    height: SCROLL_BOUNDARY_HEIGHT,
    backgroundColor: '#E4E4E4',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 2,
  },
  dailyScrollBoundary: {
    transform: [{ translateY: 2 }],
  },
  historyPane: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  messageBody: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  historySection: {
    flex: 1,
    marginTop: 4,
  },
  historySectionFixedTitle: {
    gap: 8,
  },
  historyTableScroll: {
    flex: 1,
  },
  historyTableScrollContent: {
    paddingBottom: 112,
  },
  historyTableScrollContentWithTitle: {
    gap: 8,
  },
  historyTableList: {
    gap: 14,
  },
  historyTitle: {
    width: '90%',
    maxWidth: 338,
    alignSelf: 'flex-start',
    marginLeft: '3%',
    color: '#333333',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    transform: [{ translateX: 4 }],
  },
  historyCard: {
    width: '90%',
    maxWidth: 338,
    alignSelf: 'flex-start',
    marginLeft: '3%',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    transform: [{ translateY: 8 }],
  },
  historyDateText: {
    color: '#111111',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 6,
    transform: [{ translateY: 3 }],
  },
  historyRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#D0D0D0',
  },
  historyTimeRange: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  historyTimeText: {
    flexShrink: 1,
    color: '#111111',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    transform: [{ translateY: -0.5 }],
  },
  historyTimeTextUpperRows: {
    transform: [{ translateY: -0.25 }],
  },
  historyTimeTextLastRow: {
    transform: [{ translateY: -0.75 }],
  },
  historyCycleText: {
    flexShrink: 0,
    color: '#6B6B6B',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    transform: [{ translateX: -2 }],
  },
  emptyHistory: {
    minHeight: 30,
    justifyContent: 'center',
  },
  emptyHistoryText: {
    color: '#777777',
    fontFamily: 'HiraginoSans-W6',
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
    minHeight: WEEKLY_CHART_WRAP_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: WEEKLY_CHART_WRAP_PADDING_TOP,
    paddingBottom: WEEKLY_CHART_WRAP_PADDING_BOTTOM,
  },
  weeklyChartSvgFrame: {
    height: WEEKLY_CHART_HEIGHT,
    overflow: 'visible',
  },
  weeklyChartSvg: {
    position: 'absolute',
    top: -WEEKLY_CHART_TOP_OVERFLOW,
    overflow: 'visible',
  },
  weeklyChartSlot: {
    width: '96%',
    maxWidth: 360,
    minHeight: WEEKLY_CHART_SLOT_MIN_HEIGHT,
    aspectRatio: HIGHLIGHT_CARD_ASPECT_RATIO,
    alignSelf: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

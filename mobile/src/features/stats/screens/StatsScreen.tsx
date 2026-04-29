/**
 * 週単位のレポート画面。
 *
 * 上部の週ナビゲーションとハイライトは固定し、その下から教科グラフと
 * アウトプット履歴をスクロールできる構成にする。
 *
 * 未認証ユーザーはこの画面のデータを取得できないため、`/(auth)/sign-in` に誘導する。
 * サインイン成功後に戻ってこられるよう `returnTo` を渡している。
 */
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { Paragraph, SizableText, Spinner } from 'tamagui';

import { MonthlyCalendar } from '@/features/stats/components/MonthlyCalendar';
import {
  HighlightCard,
  HighlightPlaceholder,
  MonthlyHighlightCard,
} from '@/features/stats/components/ReportHighlightCards';
import {
  ErrorBody,
  OutputHistory,
  SubjectChart,
} from '@/features/stats/components/WeeklyReportSections';
import { WeekDateStrip } from '@/features/stats/components/WeekDateStrip';
import { useMonthlyWeeklyReports } from '@/features/stats/hooks/useMonthlyWeeklyReports';
import { useWeeklyReport } from '@/features/stats/hooks/useWeeklyReport';
import { getMonthStartKey } from '@/features/stats/lib/monthlyReport';
import { getReportErrorMessage } from '@/features/stats/lib/reportPresentation';
import { getMonthLabel, getSundayWeekStartKey } from '@/features/stats/lib/week';
import { useAuthStore } from '@/shared/stores/authStore';

type ReportViewMode = 'weekly' | 'monthly';

function CalendarIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4 V7" stroke="#5367FF" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M17 4 V7" stroke="#5367FF" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M5 8 H19 V20 H5 Z" stroke="#5367FF" strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M5 12 H19" stroke="#5367FF" strokeWidth={2.2} strokeLinecap="round" />
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

export function StatsScreen() {
  const uid = useAuthStore((s) => s.uid);
  const [weekStart, setWeekStart] = useState(() => getSundayWeekStartKey());
  const [reportViewMode, setReportViewMode] = useState<ReportViewMode>('weekly');
  const [calendarMonthStart, setCalendarMonthStart] = useState(() => getMonthStartKey(weekStart));
  const weeklyReportQuery = useWeeklyReport(weekStart);
  const monthlyReports = useMonthlyWeeklyReports(calendarMonthStart, reportViewMode === 'monthly');

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
    setReportViewMode('weekly');
  }, []);

  if (uid === null) {
    return (
      <Redirect
        href={{
          pathname: '/(auth)/sign-in',
          params: { returnTo: '/(tabs)/stats' },
        }}
      />
    );
  }

  const weeklyErrorMessage = weeklyReportQuery.isError
    ? getReportErrorMessage(weeklyReportQuery.error)
    : null;
  const monthlyErrorMessage = monthlyReports.isError
    ? getReportErrorMessage(monthlyReports.error)
    : null;

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

  const body = (() => {
    if (weeklyReportQuery.isPending) {
      return (
        <View style={styles.messageBody}>
          <Spinner testID="stats-loading" />
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
        <SubjectChart points={weeklyReportQuery.data.points} />
        <OutputHistory items={weeklyReportQuery.data.output_history} />
        {weeklyReportQuery.isFetching ? (
          <SizableText style={styles.refetchingText} testID="stats-refetching">
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
              <CalendarIcon />
            </Pressable>
          </View>
          {monthlyBody}
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
            <CalendarIcon />
          </Pressable>
        </View>
        <WeekDateStrip weekStart={weekStart} onWeekChange={setWeekStart} />
        <View style={styles.highlightTitleRow}>
          <SizableText style={styles.highlightTitle}>今日のハイライト</SizableText>
          <ExternalIcon />
        </View>
        {weeklyReportQuery.data ? (
          <HighlightCard data={weeklyReportQuery.data} />
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
        {body}
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
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 32,
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
  refetchingText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 16,
  },
});

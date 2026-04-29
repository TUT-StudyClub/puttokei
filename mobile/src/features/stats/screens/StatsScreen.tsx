/**
 * 週単位のレポート画面。
 *
 * 上部の週ナビゲーションとハイライトは固定し、その下から教科グラフと
 * アウトプット履歴をスクロールできる構成にする。
 *
 * 未認証ユーザーはこの画面のデータを取得できないため、`/(auth)/sign-in` に誘導する。
 * サインイン成功後に戻ってこられるよう `returnTo` を渡している。
 */
import { Redirect, type RelativePathString, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Circle, Path, Svg, SvgXml } from 'react-native-svg';
import { Button, Paragraph, SizableText, Spinner } from 'tamagui';

import { WeekDateStrip } from '@/features/stats/components/WeekDateStrip';
import { useWeeklyReport } from '@/features/stats/hooks/useWeeklyReport';
import { getMonthLabel, getSundayWeekStartKey } from '@/features/stats/lib/week';
import type { WeeklyReportPoint, WeeklyReportResponse } from '@/features/stats/types';
import type { OutputReviewItem } from '@/features/session/types';
import { isApiError } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/authStore';

const HIGHLIGHT_BACKGROUND = require('../../../../assets/images/hilight-background-1.png');
const HOURGLASS_ASSET = require('../../../../assets/images/hourglass_gradation.svg');

const SVG_UNSUPPORTED_CSS_PROPERTIES = new Set(['filter', 'isolation', 'mix-blend-mode']);

const submittedAtFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function cssPropertyToSvgAttribute(property: string) {
  return property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function cssDeclarationsToSvgAttributes(declarations: string) {
  return declarations
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === -1) return null;

      const property = declaration.slice(0, separatorIndex).trim();
      const value = declaration.slice(separatorIndex + 1).trim();
      if (!property || !value || SVG_UNSUPPORTED_CSS_PROPERTIES.has(property)) return null;

      return `${cssPropertyToSvgAttribute(property)}="${value}"`;
    })
    .filter((attribute): attribute is string => attribute !== null);
}

function inlineSvgClassStyles(xml: string) {
  const xmlWithoutUnsupportedHighlight = xml.replace(
    /\s*<rect class="cls-10" x="-9\.33" y="-28\.16" width="67\.08" height="107\.05"\/>/g,
    '',
  );
  const styleMatch = xmlWithoutUnsupportedHighlight.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
  const stylesheet = styleMatch?.[1];
  if (!stylesheet) return xmlWithoutUnsupportedHighlight;

  const classRules: Record<string, string[]> = {};
  const classRulePattern = /\.([A-Za-z0-9_-]+)\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = classRulePattern.exec(stylesheet)) !== null) {
    const className = match[1];
    const declarations = match[2];
    if (!className || !declarations) continue;

    classRules[className] = cssDeclarationsToSvgAttributes(declarations);
  }

  return xmlWithoutUnsupportedHighlight
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/class="([^"]+)"/g, (_classAttribute: string, classNames: string) => {
      const attributes = classNames
        .split(/\s+/)
        .flatMap((className) => classRules[className] ?? []);

      return attributes.join(' ');
    });
}

function CalendarIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4 V7" stroke="#333333" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M17 4 V7" stroke="#333333" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M5 8 H19 V20 H5 Z" stroke="#333333" strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M5 12 H19" stroke="#333333" strokeWidth={2.2} strokeLinecap="round" />
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

function PencilIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 19 L6.2 14.7 L15.4 5.5 L18.5 8.6 L9.3 17.8 Z" fill="#333333" />
      <Path d="M14.5 6.4 L17.6 9.5" stroke="#FFFFFF" strokeWidth={1.4} />
    </Svg>
  );
}

function HourglassFallback() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 84 136" fill="none">
      <Path
        d="M18 12 H66 M18 124 H66 M24 12 C24 35 35 44 42 54 C49 44 60 35 60 12 M24 124 C24 101 35 92 42 82 C49 92 60 101 60 124"
        stroke="#5367FF"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M31 36 H53 C50 43 45 48 42 53 C39 48 34 43 31 36 Z" fill="#78B6FF" />
      <Path d="M28 101 C34 88 50 88 56 101 C50 110 34 110 28 101 Z" fill="#F7BFCB" />
    </Svg>
  );
}

function ReportHourglassAsset() {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const source = Image.resolveAssetSource(HOURGLASS_ASSET);
    const uri = source?.uri;
    if (!uri || typeof fetch !== 'function') return;

    fetch(uri)
      .then((response) => {
        if (!response.ok && !(response.status === 0 && uri.startsWith('file://'))) {
          throw new Error(`Failed to load report hourglass SVG: ${response.status}`);
        }
        return response.text();
      })
      .then((loadedXml) => {
        if (isMounted) {
          setXml(inlineSvgClassStyles(loadedXml));
        }
      })
      .catch(() => {
        if (isMounted) {
          setXml(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!xml) return <HourglassFallback />;

  return (
    <SvgXml
      xml={xml}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      fallback={<HourglassFallback />}
      onError={() => undefined}
    />
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

function HighlightCard({ data }: { data: WeeklyReportResponse }) {
  const total = splitMinutes(data.summary.total_study_minutes);
  return (
    <ImageBackground
      source={HIGHLIGHT_BACKGROUND}
      resizeMode="cover"
      style={styles.highlightCard}
      imageStyle={styles.highlightBackground}
      testID="stats-highlight-card"
    >
      <SizableText style={styles.highlightCaption}>勉強時間合計</SizableText>
      <View style={styles.totalTimeRow}>
        <SizableText style={styles.totalTimeNumber}>{total.hours}</SizableText>
        <SizableText style={styles.totalTimeUnit}>時間</SizableText>
        <SizableText style={styles.totalTimeNumber}>{total.minutes}</SizableText>
        <SizableText style={styles.totalTimeUnit}>分</SizableText>
      </View>

      <View style={styles.highlightBody}>
        <View style={styles.hourglassColumn}>
          <View style={styles.sessionBadge}>
            <SizableText style={styles.sessionBadgeText}>
              ×{data.summary.total_sessions}
            </SizableText>
          </View>
          <View style={styles.hourglassAsset} testID="stats-hourglass-asset">
            <ReportHourglassAsset />
          </View>
        </View>
        <View style={styles.highlightMetrics}>
          <MetricLine label="インプット" minutes={data.summary.input_minutes} />
          <View style={styles.metricDivider} />
          <MetricLine label="アウトプット" minutes={data.summary.output_minutes} />
          <View style={styles.breakPill}>
            <SizableText style={styles.breakPillText}>
              休憩{data.summary.break_minutes}分
            </SizableText>
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

function SubjectChart({ points }: { points: WeeklyReportPoint[] }) {
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

function buildOutputPreview(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= 44) return compact;
  return `${compact.slice(0, 44)}…`;
}

function formatSubmittedAt(value: string): string {
  return submittedAtFormatter.format(new Date(value));
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
  const [weekStart, setWeekStart] = useState(() => getSundayWeekStartKey());
  const weeklyReportQuery = useWeeklyReport(weekStart);
  const handleRetry = useCallback(() => {
    void weeklyReportQuery.refetch();
  }, [weeklyReportQuery]);

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

  const errorMessage = weeklyReportQuery.isError
    ? isApiError(weeklyReportQuery.error)
      ? (weeklyReportQuery.error.problem?.detail ??
        weeklyReportQuery.error.problem?.title ??
        'レポートの取得に失敗しました。')
      : 'レポートの取得に失敗しました。'
    : null;

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
          message={errorMessage ?? 'レポートの取得に失敗しました。'}
          onRetry={handleRetry}
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

  return (
    <SafeAreaView style={styles.safeArea} testID="stats-root">
      <StatusBar style="dark" />
      <View style={styles.fixedHeader}>
        <View style={styles.monthRow}>
          <SizableText style={styles.monthText}>{getMonthLabel(weekStart)}</SizableText>
          <CalendarIcon />
        </View>
        <WeekDateStrip weekStart={weekStart} onWeekChange={setWeekStart} />
        <View style={styles.highlightTitleRow}>
          <SizableText style={styles.highlightTitle}>ハイライト</SizableText>
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
  monthText: {
    color: '#333333',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
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
  highlightCard: {
    width: '86%',
    maxWidth: 290,
    minHeight: 290,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 25,
    borderWidth: 4,
    borderColor: '#333333',
    backgroundColor: '#FFFFFF',
    paddingTop: 24,
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  highlightBackground: {
    borderRadius: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  hourglassColumn: {
    width: 102,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBadge: {
    position: 'absolute',
    top: 0,
    left: 4,
    zIndex: 2,
    minWidth: 38,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B6CFF',
    shadowColor: '#5367FF',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  sessionBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  hourglassAsset: {
    width: 90,
    height: 132,
  },
  highlightMetrics: {
    flex: 1,
    gap: 10,
    paddingLeft: 6,
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
    alignItems: 'flex-end',
    gap: 4,
  },
  metricValue: {
    color: '#333333',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 31,
  },
  metricUnit: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 25,
  },
  metricDivider: {
    height: 1,
    backgroundColor: '#D9D9D9',
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
  refetchingText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 16,
  },
});

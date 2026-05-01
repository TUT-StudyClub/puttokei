/**
 * インプットフェーズ画面。
 *
 * session id ごとに `useTimer.start('input', input_minutes * 60)` でカウントダウンを開始し、
 * タイマー完了時に `PATCH status=output` を送る。成功後に `/session/{id}/output` へ
 * `router.replace` で遷移する（history に残さない方針）。
 *
 * 画面構成は HomeScreen と揃えた上で、中央に円形プログレス、下部に「中断する」
 * 「5分延長」の 2 ボタンを配置する。
 */
import { useIsFocused } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import { AnnotatedOutputText } from '@/features/session/components/AnnotatedOutputText';
import {
  CircularPhaseTimer,
  HourglassBadge,
  type HourglassSandLayer,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useTodayOutputs } from '@/features/session/hooks/useTodayOutputs';
import { useThrottledRemainingSeconds, useTimer } from '@/features/session/hooks/useTimer';
import { useUpdateSessionStatus } from '@/features/session/hooks/useUpdateSessionStatus';
import type { OutputReviewItem } from '@/features/session/types';
import { OUTPUT_HISTORY_ROW_HEIGHT, OutputHistoryRow } from '@/shared/components/OutputHistoryRow';
import { useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;

const CURRENT_PHASE: SessionPhase = 'input';
const EXTEND_MINUTES = 5;

// 「今日のアウトプット」一覧で、スクロールせずに見せる最大行数。
// 4 件目以降は一覧内だけがスクロールするようにする。
const TODAY_OUTPUT_VISIBLE_ROWS = 3;

const PRIMARY_COLOR = '#4B5CFF';
// 砂時計の砂積層に使う色。PRIMARY_COLOR (画面テーマの青) と砂時計の砂色を分離するため、input 用の砂色も独立した定数で管理する。
const HOURGLASS_INPUT_COLOR = '#148BFF';
const OUTPUT_PHASE_COLOR = '#F24D7E';
const BREAK_PHASE_COLOR = '#FFFFFF';
// 白の砂は砂時計内側 (#EFEFEF) に対して視認しやすいよう、薄めに重ねる。
const BREAK_PHASE_OPACITY = 0.92;
const TEXT_ACTIVE = '#2F2F2F';
const TEXT_INACTIVE = '#9CA3AF';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';
const PANEL_BORDER_COLOR = '#D0D0D0';
const REVIEW_TEXT_MUTED = '#6B6B6B';

type SessionRouteParams = {
  id?: string;
  input?: string;
  output?: string;
  break?: string;
};

function PencilIcon({ color = TEXT_ACTIVE, size = 25 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16.7 V20 H7.3 L18.6 8.7 L15.3 5.4 L4 16.7 Z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M14.2 6.5 L17.5 9.8" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function ImageIcon({ color = TEXT_ACTIVE, size = 25 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 5 H19 V19 H5 Z"
        stroke={color}
        strokeWidth={2.1}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M6.8 16 L10.2 12.6 L13 15.2 L15 13.2 L18.2 16.4"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8.8 9.1 H8.9" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

function MicIcon({ color = TEXT_INACTIVE, size = 25 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4 C10.8 4 10 4.9 10 6 V12 C10 13.1 10.8 14 12 14 C13.2 14 14 13.1 14 12 V6 C14 4.9 13.2 4 12 4 Z"
        stroke={color}
        strokeWidth={2}
      />
      <Path d="M7 11 C7 14 9 16 12 16 C15 16 17 14 17 11" stroke={color} strokeWidth={2} />
      <Path d="M12 16 V20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

type TodayOutputListProps = {
  items: OutputReviewItem[];
  onSelect: (item: OutputReviewItem) => void;
};

function TodayOutputList({ items, onSelect }: TodayOutputListProps) {
  if (items.length === 0) return null;

  const isScrollable = items.length > TODAY_OUTPUT_VISIBLE_ROWS;

  return (
    <View style={styles.todayOutputsSection} testID="today-outputs-section">
      <SizableText style={styles.todayOutputsTitle}>今日のアウトプット</SizableText>
      <View style={styles.todayOutputsCard}>
        <ScrollView
          style={isScrollable ? styles.todayOutputsScroll : null}
          scrollEnabled={isScrollable}
          showsVerticalScrollIndicator={isScrollable}
          nestedScrollEnabled
          testID="today-outputs-scroll"
        >
          {items.map((item, index) => (
            <OutputHistoryRow
              key={item.output.id}
              item={item}
              onPress={onSelect}
              isLast={index === items.length - 1}
              testID={`today-output-row-${item.output.id}`}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

type OutputDetailCardProps = {
  item: OutputReviewItem;
  onBack: () => void;
};

function OutputDetailCard({ item, onBack }: OutputDetailCardProps) {
  const judgment = item.judgment;
  const corrections = useMemo(() => judgment?.corrections ?? [], [judgment?.corrections]);
  const hasCorrections = corrections.length > 0;
  const [selectedCorrectionIndex, setSelectedCorrectionIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedCorrectionIndex(null);
  }, [item.output.id]);

  const selectedCorrection =
    selectedCorrectionIndex !== null ? (corrections[selectedCorrectionIndex] ?? null) : null;

  const handleSelectCorrection = (index: number) => {
    setSelectedCorrectionIndex((current) => (current === index ? null : index));
  };

  return (
    <View style={styles.outputDetailSheet} testID="output-review-detail">
      <View style={styles.sheetHandle} />
      <View style={styles.outputDetailHeader}>
        <SizableText style={styles.outputDetailTitle}>
          サイクル{item.cycle_index}のアウトプット
        </SizableText>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          hitSlop={8}
          style={styles.outputDetailBackButton}
          testID="output-review-back"
        >
          <SizableText style={styles.outputDetailBack}>一覧</SizableText>
        </Pressable>
      </View>

      <View style={styles.outputPreviewFrame}>
        <View style={styles.outputModeTabs}>
          <View style={styles.outputModeTabActive}>
            <PencilIcon color={TEXT_ACTIVE} />
            <SizableText style={styles.outputModeTabTextActive}>テキスト</SizableText>
          </View>
          <View style={styles.outputModeTab}>
            <ImageIcon color={REVIEW_TEXT_MUTED} />
            <SizableText style={styles.outputModeTabText}>画像</SizableText>
          </View>
          <View style={styles.outputModeTab}>
            <MicIcon color={REVIEW_TEXT_MUTED} />
            <SizableText style={styles.outputModeTabText}>音声</SizableText>
          </View>
        </View>

        <View style={styles.outputContentBox}>
          <ScrollView nestedScrollEnabled contentContainerStyle={styles.outputContentScroll}>
            <AnnotatedOutputText
              content={item.output.content}
              corrections={corrections}
              selectedCorrectionIndex={selectedCorrectionIndex}
              onSelectCorrection={handleSelectCorrection}
              textStyle={styles.outputContentText}
              testID="output-review-annotated-text"
            />
          </ScrollView>

          {selectedCorrection ? (
            <Pressable
              onPress={() => setSelectedCorrectionIndex(null)}
              style={styles.feedbackPopover}
              testID="output-review-correction-popover"
            >
              <SizableText style={styles.feedbackHeading}>正解</SizableText>
              <SizableText style={styles.feedbackCorrect}>
                {selectedCorrection.correct_text}
              </SizableText>
              <SizableText style={styles.feedbackHeading}>解説</SizableText>
              <SizableText style={styles.feedbackBody}>
                {selectedCorrection.explanation}
              </SizableText>
            </Pressable>
          ) : judgment ? (
            <View style={styles.feedbackPopover} testID="output-review-feedback">
              <SizableText style={styles.feedbackHeading}>フィードバック</SizableText>
              <SizableText style={styles.feedbackBody}>{judgment.advice}</SizableText>
              <SizableText style={styles.feedbackBody}>
                {hasCorrections
                  ? '赤い箇所をタップすると、正解と解説を確認できます。'
                  : '今回の判定では、個別に直す箇所はありませんでした。'}
              </SizableText>
            </View>
          ) : (
            <View style={styles.feedbackPopover} testID="output-review-feedback">
              <SizableText style={styles.feedbackHeading}>判定待ち</SizableText>
              <SizableText style={styles.feedbackBody}>
                採点が完了すると、ここに判定と解説が表示されます。
              </SizableText>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export function InputScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const inputMinutes = Number(params.input) || DEFAULT_TIMER.input_minutes;
  const outputMinutes = Number(params.output) || DEFAULT_TIMER.output_minutes;
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const isFocused = useIsFocused();
  const updateStatus = useUpdateSessionStatus();
  const cancelMutation = useUpdateSessionStatus();
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const resetLoop = useLoopStore((s) => s.reset);
  const extendTimer = useTimerStore((s) => s.extend);
  const timerStatus = useTimerStore((s) => s.status);
  const totalSeconds = useTimerStore((s) => s.totalSeconds);
  // 砂時計の砂量を 1 秒刻みではなく細かく変えるための補間値。
  // SvgXml が砂進捗の更新ごとに重い XML を再パースするため、毎フレーム (60fps) ではなく
  // 100ms 間隔 (10fps) に間引いて、視覚的な滑らかさを保ちつつ JS スレッドの負荷を抑える。
  const smoothRemainingSeconds = useThrottledRemainingSeconds(100, isFocused);
  const todayOutputsQuery = useTodayOutputs(isFocused);
  const todayOutputItems = todayOutputsQuery.data?.items;
  const todayOutputs = useMemo(() => todayOutputItems ?? [], [todayOutputItems]);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const selectedOutput = useMemo(
    () => todayOutputs.find((item) => item.output.id === selectedOutputId) ?? null,
    [selectedOutputId, todayOutputs],
  );
  const hasOutputReview = todayOutputs.length > 0;
  const isDetailVisible = selectedOutput !== null;
  const hourglassSandProgress =
    totalSeconds > 0 ? Math.min(1, Math.max(0, smoothRemainingSeconds / totalSeconds)) : 1;
  // 砂時計の積層: 下から青(input) → ピンク(output) → 白(break)。
  // input 層だけが残量に応じて減り、output / break 層は満タンで上に残る。
  const hourglassSandLayers = useMemo<readonly HourglassSandLayer[]>(
    () => [
      {
        label: 'input',
        color: HOURGLASS_INPUT_COLOR,
        weight: inputMinutes,
        progress: hourglassSandProgress,
      },
      {
        label: 'output',
        color: OUTPUT_PHASE_COLOR,
        weight: outputMinutes,
        progress: 1,
      },
      {
        label: 'break',
        color: BREAK_PHASE_COLOR,
        weight: breakMinutes,
        progress: 1,
        opacity: BREAK_PHASE_OPACITY,
      },
    ],
    [inputMinutes, outputMinutes, breakMinutes, hourglassSandProgress],
  );

  const { start, reset } = useTimer({
    enabled: isFocused,
    onComplete: () => {
      updateStatus.mutate(
        { sessionId, status: 'output' },
        {
          onSuccess: () => {
            router.replace({
              pathname: '/session/[id]/output',
              params: {
                id: sessionId,
                input: String(inputMinutes),
                output: String(outputMinutes),
                break: String(breakMinutes),
              },
            });
          },
        },
      );
    },
  });

  useEffect(() => {
    start('input', inputMinutes * 60);
    return () => {
      reset();
    };
  }, [inputMinutes, reset, sessionId, start]);

  useEffect(() => {
    if (selectedOutputId !== null && selectedOutput === null) {
      setSelectedOutputId(null);
    }
  }, [selectedOutput, selectedOutputId]);

  const handleCancel = () => {
    if (cancelMutation.isPending) return;
    Alert.alert('セッションを中断しますか？', '中断するとこのセッションは終了します。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '中断する',
        style: 'destructive',
        onPress: () => {
          reset();
          cancelMutation.mutate(
            { sessionId, status: 'cancelled' },
            {
              onSuccess: () => {
                resetLoop();
                router.replace('/(tabs)');
              },
            },
          );
        },
      },
    ]);
  };

  const handleExtend = () => {
    extendTimer(EXTEND_MINUTES * 60);
  };

  const extendDisabled = timerStatus !== 'running' && timerStatus !== 'paused';
  const hasError = updateStatus.isError || cancelMutation.isError;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="input-root">
        {isDetailVisible ? null : (
          <>
            <SessionSettingsButton
              onPress={() => router.push(SETTINGS_ROUTE)}
              testID="input-settings-button"
            />

            <HourglassBadge
              currentLoop={currentLoop}
              testIDPrefix="input"
              borderColor={BORDER_COLOR}
              marginBottom={24}
              sandLayers={hourglassSandLayers}
              activeLayerIndex={0}
              showSandStream={isFocused && timerStatus === 'running'}
              variant="blue"
            />
          </>
        )}

        <PhaseTabs
          activePhase={CURRENT_PHASE}
          testIDPrefix="input"
          activeDotColor={PRIMARY_COLOR}
          inactiveDotColor={DOT_INACTIVE}
        />

        <View style={[styles.timerStage, isDetailVisible ? styles.timerStageDetail : null]}>
          <CircularPhaseTimer
            phase={CURRENT_PHASE}
            primaryColor={PRIMARY_COLOR}
            trackColor={BORDER_COLOR}
            testID="input-circular-timer"
            compact={hasOutputReview}
            enabled={isFocused}
          />
          {isDetailVisible ? null : (
            <SizableText style={styles.timerCaption} testID="input-timer-caption">
              終了後{outputMinutes}分間でアウトプットです{'\n'}アウトプットへは自動で切り替わります
            </SizableText>
          )}
        </View>

        {selectedOutput ? (
          <OutputDetailCard item={selectedOutput} onBack={() => setSelectedOutputId(null)} />
        ) : (
          <TodayOutputList
            items={todayOutputs}
            onSelect={(item) => setSelectedOutputId(item.output.id)}
          />
        )}

        {hasError ? (
          <SizableText style={styles.errorText} size="$3" testID="input-screen-error">
            通信エラーが発生しました。時間をおいて再度お試しください。
          </SizableText>
        ) : null}

        <View style={styles.actionArea}>
          <Pressable
            accessibilityRole="button"
            disabled={cancelMutation.isPending}
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed ? styles.buttonPressed : null,
              cancelMutation.isPending ? styles.buttonDisabled : null,
            ]}
            testID="input-cancel-button"
          >
            <SizableText style={styles.cancelButtonText}>中断する</SizableText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={extendDisabled}
            onPress={handleExtend}
            style={({ pressed }) => [
              styles.extendButton,
              pressed ? styles.buttonPressed : null,
              extendDisabled ? styles.buttonDisabled : null,
            ]}
            testID="input-extend-button"
          >
            <SizableText style={styles.extendButtonText}>{EXTEND_MINUTES}分延長</SizableText>
          </Pressable>
        </View>
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
    paddingTop: 12,
    paddingRight: 24,
    paddingBottom: 32,
    paddingLeft: 24,
  },
  timerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  timerStageDetail: {
    flex: 0,
    gap: 10,
    marginBottom: 12,
  },
  timerCaption: {
    color: CAPTION_COLOR,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  todayOutputsSection: {
    gap: 8,
    marginBottom: 16,
  },
  todayOutputsTitle: {
    color: TEXT_ACTIVE,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  todayOutputsCard: {
    borderWidth: 1,
    borderColor: PANEL_BORDER_COLOR,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  todayOutputsScroll: {
    maxHeight: OUTPUT_HISTORY_ROW_HEIGHT * TODAY_OUTPUT_VISIBLE_ROWS,
  },
  outputDetailSheet: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 14,
    paddingRight: 18,
    paddingBottom: 18,
    paddingLeft: 18,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 4,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 56,
    height: 4,
    borderRadius: 999,
    marginBottom: 18,
    backgroundColor: '#CFCFCF',
  },
  outputDetailHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  outputDetailTitle: {
    color: TEXT_ACTIVE,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  outputDetailBack: {
    color: REVIEW_TEXT_MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  outputDetailBackButton: {
    position: 'absolute',
    right: 0,
    height: 34,
    justifyContent: 'center',
  },
  outputPreviewFrame: {
    borderWidth: 1.5,
    borderColor: TEXT_ACTIVE,
    borderRadius: 20,
    padding: 16,
  },
  outputModeTabs: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PANEL_BORDER_COLOR,
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    backgroundColor: '#F3F3F3',
  },
  outputModeTabActive: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  outputModeTab: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  outputModeTabTextActive: {
    color: TEXT_ACTIVE,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  outputModeTabText: {
    color: REVIEW_TEXT_MUTED,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  outputContentBox: {
    minHeight: 190,
    borderWidth: 1,
    borderColor: PANEL_BORDER_COLOR,
    borderRadius: 12,
    overflow: 'hidden',
  },
  outputContentScroll: {
    padding: 18,
    paddingBottom: 130,
  },
  outputContentText: {
    color: TEXT_ACTIVE,
    fontSize: 16,
    lineHeight: 24,
  },
  feedbackPopover: {
    position: 'absolute',
    left: 30,
    right: 30,
    top: 58,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#333333',
  },
  feedbackHeading: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
  },
  feedbackCorrect: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 12,
  },
  feedbackBody: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 4,
  },
  errorText: {
    color: ERROR_COLOR,
    textAlign: 'center',
    marginBottom: 8,
  },
  actionArea: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D0D5DD',
  },
  cancelButtonText: {
    color: TEXT_ACTIVE,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  extendButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 18,
    backgroundColor: PRIMARY_COLOR,
  },
  extendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

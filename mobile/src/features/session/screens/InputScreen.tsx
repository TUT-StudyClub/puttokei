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
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  LayoutAnimation,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import { AnnotatedOutputImage } from '@/features/session/components/AnnotatedOutputImage';
import { AnnotatedOutputText } from '@/features/session/components/AnnotatedOutputText';
import {
  CircularPhaseTimer,
  type HourglassSandLayer,
  SESSION_TOP_CHROME_CONTENT_TOP,
  type SessionPhase,
  SessionTopChrome,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useTodayOutputs } from '@/features/session/hooks/useTodayOutputs';
import { useThrottledRemainingSeconds, useTimer } from '@/features/session/hooks/useTimer';
import { useUpdateSessionStatus } from '@/features/session/hooks/useUpdateSessionStatus';
import type { OutputReviewItem } from '@/features/session/types';
import { OUTPUT_HISTORY_ROW_HEIGHT, OutputHistoryRow } from '@/shared/components/OutputHistoryRow';
import { useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const CURRENT_PHASE: SessionPhase = 'input';
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
const POPOVER_WIDTH = 220;

// 「今日のアウトプット」一覧で、スクロールせずに見せる最大行数。
// 4 件目以降は一覧内だけがスクロールするようにする。
const TODAY_OUTPUT_VISIBLE_ROWS = 3;

const PRIMARY_COLOR = '#148BFF';
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
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M10.6973 4.25391C11.056 4.13455 11.444 4.13455 11.8027 4.25391C12.0441 4.33428 12.2342 4.46901 12.3945 4.60547C12.5484 4.7364 12.7189 4.90834 12.9053 5.09473C13.0917 5.28111 13.2636 5.45161 13.3945 5.60547C13.531 5.76581 13.6657 5.95586 13.7461 6.19727C13.8655 6.55596 13.8655 6.94404 13.7461 7.30273C13.6657 7.54414 13.531 7.73418 13.3945 7.89453C13.2636 8.04839 13.0917 8.21889 12.9053 8.40527L7.67188 13.6387C7.50541 13.8051 7.32789 13.9914 7.10059 14.1201C6.87333 14.2487 6.62283 14.3052 6.39453 14.3623L4.77637 14.7656L4.77344 14.7676L4.74023 14.7754C4.58421 14.8144 4.38429 14.867 4.21289 14.8838C4.03218 14.9015 3.67581 14.9024 3.38672 14.6133C3.09762 14.3242 3.09853 13.9678 3.11621 13.7871C3.13298 13.6157 3.1856 13.4158 3.22461 13.2598L3.6377 11.6055C3.69477 11.3772 3.75131 11.1267 3.87988 10.8994C4.00858 10.6721 4.19486 10.4946 4.36133 10.3281L9.59473 5.09473C9.78111 4.90834 9.95161 4.7364 10.1055 4.60547C10.2658 4.46901 10.4559 4.33428 10.6973 4.25391Z"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path d="M9.375 5.625L11.625 4.125L13.875 6.375L12.375 8.625L9.375 5.625Z" fill={color} />
    </Svg>
  );
}

function ImageIcon({ color = TEXT_ACTIVE, size = 25 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M2.25 6.25C2.25 4.04086 4.04086 2.25 6.25 2.25H11.75C13.9591 2.25 15.75 4.04086 15.75 6.25V11.75C15.75 13.9591 13.9591 15.75 11.75 15.75H6.25C4.04086 15.75 2.25 13.9591 2.25 11.75V6.25Z"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M2.25 11.25L3.9305 9.5695C4.81282 8.68718 6.2788 8.81935 6.98908 9.84526L7.76644 10.9681C8.43112 11.9281 9.77349 12.117 10.6773 11.3776L11.7241 10.521C12.5194 9.87039 13.6783 9.92821 14.4048 10.6548L15.75 12"
        stroke={color}
        strokeWidth={1.5}
      />
      <Circle cx={12} cy={6} r={1.5} fill={color} />
    </Svg>
  );
}

function ChevronLeftIcon() {
  return (
    <Svg width={6} height={16} viewBox="0 0 5 10" fill="none">
      <Path
        d="M4 1L1 5L4 9"
        stroke="#676767"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MicIcon({ color = TEXT_INACTIVE, size = 25 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Rect
        x={6.75}
        y={2.25}
        width={4.5}
        height={8.25}
        rx={2.25}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M3.75 8.25C3.75 9.64239 4.30312 10.9777 5.28769 11.9623C6.27226 12.9469 7.60761 13.5 9 13.5C10.3924 13.5 11.7277 12.9469 12.7123 11.9623C13.6969 10.9777 14.25 9.64239 14.25 8.25"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 15.75V14.25"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      <SizableText style={styles.todayOutputsTitle}>最近のアウトプット</SizableText>
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
  onDismiss?: () => void;
  sheetPaddingBottom?: number;
  contentAreaRef?: React.RefObject<View>;
};

const FEEDBACK_INDICATOR_HEIGHT = 36;

function OutputDetailCard({
  item,
  onDismiss,
  sheetPaddingBottom,
  contentAreaRef,
}: OutputDetailCardProps) {
  const judgment = item.judgment;
  const corrections = useMemo(() => judgment?.corrections ?? [], [judgment?.corrections]);
  const [selectedCorrectionIndex, setSelectedCorrectionIndex] = useState<number | null>(null);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const feedbackScrollY = useRef(new Animated.Value(0)).current;
  const [feedbackContentHeight, setFeedbackContentHeight] = useState(0);
  const [feedbackPopoverHeight, setFeedbackPopoverHeight] = useState(0);
  const [popoverCenterX, setPopoverCenterX] = useState(0);
  const [popoverTop, setPopoverTop] = useState(0);
  const imageExpandedContainerRef = useRef<View>(null);
  const feedbackIndicatorTop = useMemo(
    () =>
      feedbackScrollY.interpolate({
        inputRange: [0, Math.max(feedbackContentHeight - feedbackPopoverHeight, 1)],
        outputRange: [4, Math.max(4, feedbackPopoverHeight - FEEDBACK_INDICATOR_HEIGHT - 4)],
        extrapolate: 'clamp',
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feedbackScrollY, feedbackContentHeight, feedbackPopoverHeight],
  );

  useEffect(() => {
    setSelectedCorrectionIndex(null);
    setIsImageExpanded(false);
    feedbackScrollY.setValue(0);
  }, [item.output.id, feedbackScrollY]);

  const selectedCorrection =
    selectedCorrectionIndex !== null ? (corrections[selectedCorrectionIndex] ?? null) : null;

  const handleSelectCorrection = (index: number, pageX?: number, pageY?: number) => {
    if (pageX === undefined && pageY === undefined) {
      setSelectedCorrectionIndex((current) => (current === index ? null : index));
    } else if (pageX !== undefined && pageY !== undefined) {
      setPopoverCenterX(pageX);
      setPopoverTop(Math.min(pageY + 8, SCREEN_HEIGHT - 190));
    }
  };

  const handleAutoSelect = useCallback(
    (index: number, relBboxCenterX: number, relBboxBottomY: number) => {
      const containerEl = imageExpandedContainerRef.current;
      const contentAreaEl = contentAreaRef?.current;
      if (!containerEl || !contentAreaEl) {
        setSelectedCorrectionIndex(index);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      containerEl.measureLayout(
        contentAreaEl as any,
        (containerLayoutX: number, containerLayoutY: number) => {
          contentAreaEl.measureInWindow((caScreenX: number, caScreenY: number) => {
            setSelectedCorrectionIndex(index);
            setPopoverCenterX(caScreenX + containerLayoutX + relBboxCenterX);
            setPopoverTop(
              Math.min(caScreenY + containerLayoutY + relBboxBottomY + 13, SCREEN_HEIGHT - 190),
            );
          });
        },
        () => {
          setSelectedCorrectionIndex(index);
        },
      );
    },
    [contentAreaRef],
  );

  const popoverLeftBound = isImageExpanded ? 59 : 36;
  const popoverRightBound = isImageExpanded ? 342 : SCREEN_WIDTH - 36;
  const popoverLeft = Math.max(
    popoverLeftBound,
    Math.min(popoverCenterX - POPOVER_WIDTH / 2, popoverRightBound - POPOVER_WIDTH),
  );
  const arrowMarginLeft = Math.max(
    8,
    Math.min(popoverCenterX - popoverLeft - 8, POPOVER_WIDTH - 24),
  );

  return (
    <>
      <View style={styles.outputDetailContainer} testID="output-review-detail">
        <View
          style={[
            styles.outputDetailSheet,
            sheetPaddingBottom !== undefined ? { paddingBottom: sheetPaddingBottom } : null,
          ]}
        >
          <Pressable onPress={onDismiss} hitSlop={12} style={styles.sheetHandle} />
          {!isImageExpanded && (
            <View style={styles.outputDetailHeader}>
              <Text style={styles.outputDetailTitle}>サイクル{item.cycle_index}のアウトプット</Text>
            </View>
          )}

          {isImageExpanded && item.output.image_url ? (
            <View style={styles.outputPreviewFrameExpanded}>
              <Pressable
                onPress={() => {
                  setIsImageExpanded(false);
                  setSelectedCorrectionIndex(null);
                }}
                style={styles.imageExpandedBack}
                hitSlop={12}
              >
                <ChevronLeftIcon />
              </Pressable>
              <View ref={imageExpandedContainerRef} style={styles.imageExpandedContainer}>
                <AnnotatedOutputImage
                  imageUrl={item.output.image_url}
                  corrections={corrections}
                  selectedCorrectionIndex={selectedCorrectionIndex}
                  onSelectCorrection={handleSelectCorrection}
                  autoHeight
                  autoSelectIndex={corrections.length > 0 ? 0 : null}
                  onAutoSelect={handleAutoSelect}
                  testID="output-review-image"
                />
              </View>
            </View>
          ) : (
            <View style={styles.outputPreviewFrame}>
              <View style={styles.outputModeTabs}>
                <View style={styles.outputModeTabFlex}>
                  <View
                    style={
                      item.output.kind === 'text'
                        ? styles.outputModeTabActive
                        : styles.outputModeTab
                    }
                  >
                    <PencilIcon
                      color={item.output.kind === 'text' ? TEXT_ACTIVE : REVIEW_TEXT_MUTED}
                      size={19}
                    />
                    <Text
                      style={
                        item.output.kind === 'text'
                          ? styles.outputModeTabTextActive
                          : styles.outputModeTabText
                      }
                    >
                      テキスト
                    </Text>
                  </View>
                </View>
                <View style={styles.outputModeTabFlex}>
                  <View
                    style={
                      item.output.kind === 'image'
                        ? styles.outputModeTabActive
                        : styles.outputModeTab
                    }
                  >
                    <ImageIcon
                      color={item.output.kind === 'image' ? TEXT_ACTIVE : REVIEW_TEXT_MUTED}
                      size={19}
                    />
                    <Text
                      style={
                        item.output.kind === 'image'
                          ? styles.outputModeTabTextActive
                          : styles.outputModeTabText
                      }
                    >
                      画像
                    </Text>
                  </View>
                </View>
                <View style={styles.outputModeTabFlex}>
                  <View style={styles.outputModeTab}>
                    <MicIcon color={REVIEW_TEXT_MUTED} size={19} />
                    <Text style={styles.outputModeTabText}>音声</Text>
                  </View>
                </View>
              </View>

              <View
                style={[
                  styles.outputContentBox,
                  item.output.kind === 'image' ? { borderWidth: 0 } : null,
                ]}
              >
                {item.output.kind === 'image' && item.output.image_url ? (
                  <Pressable
                    onPress={() => {
                      setIsImageExpanded(true);
                    }}
                    style={styles.imageThumbnailWrapper}
                  >
                    <Image source={{ uri: item.output.image_url }} style={styles.imageThumbnail} />
                  </Pressable>
                ) : (
                  <ScrollView
                    nestedScrollEnabled
                    contentContainerStyle={styles.outputContentScroll}
                  >
                    <AnnotatedOutputText
                      content={item.output.content ?? ''}
                      corrections={corrections}
                      selectedCorrectionIndex={selectedCorrectionIndex}
                      onSelectCorrection={handleSelectCorrection}
                      textStyle={styles.outputContentText}
                      testID="output-review-annotated-text"
                    />
                  </ScrollView>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
      <Modal
        visible={!!selectedCorrection}
        transparent
        animationType="none"
        onRequestClose={() => setSelectedCorrectionIndex(null)}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setSelectedCorrectionIndex(null)}
        />
        {selectedCorrection && (
          <View
            style={[styles.feedbackPopoverWrapper, { top: popoverTop, left: popoverLeft }]}
            testID="output-review-correction-popover"
          >
            <View style={[styles.feedbackPopoverArrow, { marginLeft: arrowMarginLeft }]} />
            <View
              style={styles.feedbackPopover}
              onLayout={(e) => setFeedbackPopoverHeight(e.nativeEvent.layout.height)}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="解説を閉じる"
                hitSlop={8}
                onPress={() => setSelectedCorrectionIndex(null)}
                style={({ pressed }) => [
                  styles.feedbackPopoverClose,
                  pressed ? styles.feedbackPopoverClosePressed : null,
                ]}
                testID="output-review-correction-close"
              >
                <Svg width={12} height={12} viewBox="0 0 16 16" fill="none">
                  <Path
                    d="M2 2L14 14M14 2L2 14"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
              <ScrollView
                style={styles.feedbackPopoverScroll}
                contentContainerStyle={styles.feedbackPopoverScrollContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: feedbackScrollY } } }],
                  { useNativeDriver: false },
                )}
                onContentSizeChange={(_, h) => setFeedbackContentHeight(h)}
              >
                <SizableText style={styles.feedbackHeading}>正解</SizableText>
                <SizableText style={styles.feedbackCorrect}>
                  {selectedCorrection.correct_text}
                </SizableText>
                <SizableText style={styles.feedbackHeading}>解説</SizableText>
                <SizableText style={styles.feedbackBody}>
                  {selectedCorrection.explanation}
                </SizableText>
              </ScrollView>
              {feedbackContentHeight > feedbackPopoverHeight && (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.feedbackScrollIndicator, { top: feedbackIndicatorTop }]}
                />
              )}
            </View>
          </View>
        )}
      </Modal>
    </>
  );
}

export function InputScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const inputMinutes = Number(params.input) || DEFAULT_TIMER.input_minutes;
  const outputMinutes = Number(params.output) || DEFAULT_TIMER.output_minutes;
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const contentAreaRef = useRef<View>(null);
  const router = useRouter();
  const isFocused = useIsFocused();
  const updateStatus = useUpdateSessionStatus();
  const cancelMutation = useUpdateSessionStatus();
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const resetLoop = useLoopStore((s) => s.reset);
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

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  // slideAnim とは独立したタイマースケール値。
  // カード出現時の初期ジャンプを防ぐため 1 で初期化し、
  // パンジェスチャーでカードを下げたときだけ段階的に拡大する。
  const timerScaleAnim = useRef(new Animated.Value(1)).current;
  const timerCompactOpacity = useRef(new Animated.Value(1)).current;
  // scale 拡大と同時に下方向へ移動させる。
  // compact 中心(78px) → non-compact 中心(145px) の差分 67px 分だけ下げることで、
  // dismiss 完了時に non-compact タイマーの位置にぴったり繋がる。
  const timerTranslateYAnim = useMemo(
    () =>
      timerScaleAnim.interpolate({
        inputRange: [1, 290 / 156],
        outputRange: [0, (290 - 156) / 2],
        extrapolate: 'clamp',
      }),
    [timerScaleAnim],
  );
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gs) =>
        gs.dy > 8 && gs.dy > Math.abs(gs.dx) && evt.nativeEvent.locationY < 120,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          slideAnim.setValue(gs.dy);
          timerScaleAnim.setValue(1 + Math.min(gs.dy / (SCREEN_HEIGHT / 3), 1) * (290 / 156 - 1));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.8) {
          Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 280,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            slideAnim.setValue(SCREEN_HEIGHT);
            timerCompactOpacity.setValue(0);
            LayoutAnimation.configureNext({
              duration: 220,
              create: { type: 'easeInEaseOut', property: 'opacity' },
              update: { type: 'easeInEaseOut' },
            });
            setSelectedOutputId(null);
          });
        } else {
          Animated.parallel([
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 200,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(timerScaleAnim, {
              toValue: 1,
              duration: 200,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
    }),
  ).current;

  const dismissDetail = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(timerScaleAnim, {
        toValue: 290 / 156,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      slideAnim.setValue(SCREEN_HEIGHT);
      timerCompactOpacity.setValue(0);
      LayoutAnimation.configureNext({
        duration: 220,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'easeInEaseOut' },
      });
      setSelectedOutputId(null);
    });
  }, [slideAnim, timerScaleAnim, timerCompactOpacity]);

  useEffect(() => {
    if (selectedOutputId) {
      timerScaleAnim.setValue(1);
      timerCompactOpacity.setValue(1);
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [selectedOutputId, slideAnim, timerScaleAnim, timerCompactOpacity]);
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

  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: isDetailVisible ? { display: 'none' } : { paddingTop: 10 },
    });
  }, [isDetailVisible, navigation]);

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

  const hasError = updateStatus.isError || cancelMutation.isError;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="input-root">
        <SessionTopChrome
          testIDPrefix="input"
          showHeader={!isDetailVisible}
          phaseTabsTop={isDetailVisible ? '0.8%' : undefined}
          hourglass={{
            currentLoop,
            borderColor: BORDER_COLOR,
            sandLayers: hourglassSandLayers,
            activeLayerIndex: 0,
            showSandStream: isFocused && timerStatus === 'running',
            variant: 'blue',
          }}
          phaseTabs={{
            activePhase: CURRENT_PHASE,
            activeDotColor: PRIMARY_COLOR,
            activeTextColor: PRIMARY_COLOR,
            inactiveDotColor: DOT_INACTIVE,
          }}
        />

        <View
          ref={contentAreaRef}
          style={[styles.contentArea, isDetailVisible ? styles.contentAreaDetail : null]}
        >
          <View
            style={[
              styles.timerStage,
              isDetailVisible || hasOutputReview ? styles.timerStageDetail : null,
            ]}
          >
            {isDetailVisible ? (
              <Animated.View
                style={{
                  transform: [{ scale: timerScaleAnim }, { translateY: timerTranslateYAnim }],
                  opacity: timerCompactOpacity,
                  marginTop: -1,
                }}
              >
                <CircularPhaseTimer
                  phase={CURRENT_PHASE}
                  primaryColor={PRIMARY_COLOR}
                  trackColor="#E9F9FF"
                  testID="input-circular-timer"
                  compact
                  strokeWidth={9}
                  enabled={isFocused}
                  timerTextStyle={{ transform: [{ translateY: -2.45 }], fontSize: 30 }}
                  phaseLabelStyle={{ transform: [{ translateY: -2.05 }] }}
                />
              </Animated.View>
            ) : (
              <CircularPhaseTimer
                phase={CURRENT_PHASE}
                primaryColor={PRIMARY_COLOR}
                trackColor="#E9F9FF"
                testID="input-circular-timer"
                compact={false}
                enabled={isFocused}
                timerTextStyle={styles.inputTimerText}
              />
            )}
            {isDetailVisible || hasOutputReview ? null : (
              <Text style={styles.timerCaption} testID="input-timer-caption">
                終了後{outputMinutes}分間でアウトプットです{'\n'}
                アウトプットへは自動で切り替わります
              </Text>
            )}
          </View>

          {selectedOutput ? (
            <Animated.View
              style={[styles.outputDetailAnimWrapper, { transform: [{ translateY: slideAnim }] }]}
              {...panResponder.panHandlers}
            >
              <OutputDetailCard
                item={selectedOutput}
                onDismiss={dismissDetail}
                sheetPaddingBottom={insets.bottom + 104}
                contentAreaRef={contentAreaRef}
              />
            </Animated.View>
          ) : (
            <TodayOutputList
              items={todayOutputs}
              onSelect={(item) => {
                LayoutAnimation.configureNext({
                  duration: 300,
                  update: { type: 'easeInEaseOut' },
                });
                setSelectedOutputId(item.output.id);
              }}
            />
          )}

          {hasError ? (
            <SizableText style={styles.errorText} size="$3" testID="input-screen-error">
              通信エラーが発生しました。時間をおいて再度お試しください。
            </SizableText>
          ) : null}

          {!isDetailVisible && (
            <Pressable
              accessibilityRole="button"
              disabled={cancelMutation.isPending}
              onPress={handleCancel}
              style={({ pressed }) => [
                hasOutputReview ? styles.cancelButtonFlow : styles.cancelButton,
                pressed ? styles.buttonPressed : null,
                cancelMutation.isPending ? styles.buttonDisabled : null,
              ]}
              testID="input-cancel-button"
            >
              <Text style={styles.cancelButtonText}>中断する</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
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
  contentArea: {
    position: 'absolute',
    top: SESSION_TOP_CHROME_CONTENT_TOP,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  timerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 20,
    paddingBottom: '38.3%',
    marginTop: '0.4%',
  },
  contentAreaDetail: {
    top: '7.5%',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  outputDetailAnimWrapper: {
    flex: 1,
  },
  timerStageDetail: {
    flex: 0,
    gap: 10,
    marginBottom: 12,
    paddingBottom: 0,
  },
  inputTimerText: {
    transform: [{ translateY: -5 }],
  },
  timerCaption: {
    color: '#9D9D9D',
    fontFamily: 'HiraginoSans-W4',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
  todayOutputsSection: {
    gap: 8,
    marginTop: '1.4%',
    marginBottom: '5.7%',
    marginHorizontal: 22,
  },
  todayOutputsTitle: {
    color: '#363636',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 10,
    lineHeight: 20,
    textAlign: 'center',
  },
  todayOutputsCard: {
    borderWidth: 1,
    borderColor: '#CDCDCD',
    borderRadius: 20,
    paddingTop: 12,
    paddingBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
    marginTop: 1.9,
  },
  todayOutputsScroll: {
    maxHeight: OUTPUT_HISTORY_ROW_HEIGHT * TODAY_OUTPUT_VISIBLE_ROWS,
  },
  outputDetailContainer: {
    flex: 1,
  },
  outputDetailSheet: {
    flex: 1,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 10.5,
    paddingRight: 18,
    paddingBottom: 18,
    paddingLeft: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 49.5,
    height: 3,
    borderRadius: 999,
    marginBottom: 19,
    backgroundColor: '#CDCDCD',
  },
  outputDetailHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
    marginBottom: 12,
  },
  outputDetailTitle: {
    color: '#363636',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 12,
    lineHeight: 18,
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
    flex: 1,
    borderWidth: 2,
    borderColor: '#6D6D6D',
    borderRadius: 16,
    paddingTop: 12,
    paddingRight: 18,
    paddingBottom: 18,
    paddingLeft: 18,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  outputPreviewFrameExpanded: {
    backgroundColor: '#FFFFFF',
  },
  imageExpandedContainer: {
    marginLeft: 41,
    width: 283,
  },
  outputModeTabs: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 3,
    gap: 5,
    backgroundColor: '#EFEFEF',
  },
  outputModeTabFlex: {
    flex: 1,
  },
  outputModeTabActive: {
    marginLeft: 0,
    marginRight: 8,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 5,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 3,
    backgroundColor: '#FFFFFF',
  },
  outputModeTab: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 5,
    paddingRight: 6,
  },
  outputModeTabTextActive: {
    color: '#363636',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 9,
    lineHeight: 16,
  },
  outputModeTabText: {
    color: '#676767',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 9,
    lineHeight: 16,
  },
  outputContentBox: {
    flex: 1,
    minHeight: 196,
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
    color: '#000000',
    fontFamily: 'HiraginoSans-W4',
    fontSize: 10,
    lineHeight: 16,
  },
  feedbackPopoverWrapper: {
    position: 'absolute',
    width: POPOVER_WIDTH,
  },
  feedbackPopoverArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#333333',
    alignSelf: 'flex-start',
  },
  feedbackPopover: {
    height: 160,
    borderRadius: 12,
    backgroundColor: '#333333',
    overflow: 'hidden',
  },
  feedbackPopoverScroll: {
    flex: 1,
  },
  feedbackPopoverScrollContent: {
    paddingTop: 23,
    paddingRight: 14,
    paddingBottom: 16,
    paddingLeft: 20,
  },
  feedbackPopoverClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    zIndex: 1,
  },
  feedbackPopoverClosePressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  feedbackPopoverCloseText: {
    color: '#FFFFFF',
    fontFamily: 'HiraginoSans-W4',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
  feedbackHeading: {
    color: '#FFFFFF',
    fontFamily: 'HiraginoSans-W4',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 16,
  },
  feedbackCorrect: {
    color: '#FFFFFF',
    fontFamily: 'HiraginoSans-W3',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  feedbackBody: {
    color: '#FFFFFF',
    fontFamily: 'HiraginoSans-W3',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  feedbackScrollIndicator: {
    position: 'absolute',
    right: 3,
    width: 3,
    height: FEEDBACK_INDICATOR_HEIGHT,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  imageThumbnailWrapper: {
    padding: 12,
  },
  imageThumbnail: {
    width: 97,
    height: 97,
    borderRadius: 8,
  },
  imageExpandedBack: {
    paddingLeft: 46,
    paddingTop: 6,
    paddingBottom: 0,
    height: 28,
    justifyContent: 'flex-start',
  },
  errorText: {
    color: ERROR_COLOR,
    textAlign: 'center',
    marginBottom: 8,
  },
  actionArea: {},
  cancelButton: {
    position: 'absolute',
    bottom: '21%',
    left: '15.8%',
    right: '16.3%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '3.2%',
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6D6D6D',
  },
  cancelButtonFlow: {
    alignSelf: 'center',
    width: 290,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '4.6%',
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6D6D6D',
    marginTop: '4%',
  },
  cancelButtonText: {
    color: '#6D6D6D',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 14,
    lineHeight: 22,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

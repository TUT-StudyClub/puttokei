/**
 * 休憩フェーズ画面 (S-07 / S-08-2)。
 *
 * 休憩中は既存のタイマーと AI 採点進捗を表示する。休憩タイマー完了後は、
 * 参考画面に合わせて「休憩完了」→「次サイクル準備」の 2 段階 UI に切り替える。
 */
import { useIsFocused } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Path, Svg, SvgXml } from 'react-native-svg';
import { SizableText, Spinner } from 'tamagui';

import { createSession } from '@/features/session/api/sessionApi';
import {
  BreakCompletedView,
  HourglassGraphic,
} from '@/features/session/components/BreakCompletedView';
import {
  CircularPhaseTimer,
  HourglassBadge,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useJudgment } from '@/features/session/hooks/useJudgment';
import { useNextCycleRotation } from '@/features/session/hooks/useNextCycleRotation';
import { useSmoothRemainingSeconds, useTimer } from '@/features/session/hooks/useTimer';
import type { CreateSessionInput, Session } from '@/features/session/types';
import { APP_COLORS } from '@/shared/lib/colors';
import { inlineSvgClassStyles } from '@/shared/lib/svgStyles';
import { LOOP_COUNT_MAX, useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;
const NEXT_CYCLE_HOURGLASS_ASSET = require('../../../../assets/images/session/hourglass-gradation.svg');
const NEXT_CYCLE_HOURGLASS_ASPECT_RATIO = 76.91 / 43.11;

const CURRENT_PHASE: SessionPhase = 'break';

// 休憩中はグレー、次サイクル準備ではインプットと同じブルーを使う。
const BREAK_COLOR = APP_COLORS.textInactive;
const INPUT_COLOR = APP_COLORS.input;
const TEXT_ACTIVE = APP_COLORS.textPrimary;
const DOT_INACTIVE = APP_COLORS.dotInactive;
const BORDER_COLOR = APP_COLORS.border;
const CAPTION_COLOR = APP_COLORS.textMuted;
const ERROR_COLOR = APP_COLORS.error;

// 下部の「採点進捗カード」用トークン。濃い背景に青いプログレスバーを乗せる。
const PROGRESS_CARD_BG = '#2A2A2E';
const PROGRESS_CARD_TEXT = '#FFFFFF';
const PROGRESS_CARD_SUBTEXT = '#B5B7BC';
const PROGRESS_TRACK_COLOR = '#4A4A50';
const PROGRESS_FILL_COLOR = '#4B5CFF';

// 採点進捗の下限 / 上限。ready になるまでは 90% で頭打ちにする。
const PROGRESS_PENDING_MIN = 12;
const PROGRESS_PENDING_MAX = 90;

type BreakScreenMode = 'resting' | 'completed' | 'nextCycle';

const COMPLETED_PHASE_COLORS: Record<SessionPhase, string> = {
  input: '#A7D4F7',
  output: '#F8D8E4',
  break: '#C9C9C9',
};

const NEXT_CYCLE_SVG_STYLE_ATTRIBUTE_NAMES: Record<string, string> = {
  'clip-path': 'clipPath',
  'color-interpolation-filters': 'colorInterpolationFilters',
  'fill-rule': 'fillRule',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-width': 'strokeWidth',
};

const NEXT_CYCLE_SVG_UNSUPPORTED_STYLE_PROPERTIES = new Set(['isolation', 'mix-blend-mode']);

type JudgingProgressCardProps = {
  progressPercent: number;
  isReady: boolean;
};

function JudgingProgressCard({ progressPercent, isReady }: JudgingProgressCardProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(progressPercent)));
  return (
    <View style={styles.progressCard} testID="break-progress-card">
      <View style={styles.progressHeaderRow}>
        <SizableText style={styles.progressHeaderLabel}>
          {isReady ? ' ' : 'テキストの解析...'}
        </SizableText>
        <SizableText style={styles.progressHeaderPercent} testID="break-progress-percent">
          {clamped}%
        </SizableText>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${clamped}%` }]} />
      </View>
      {isReady ? (
        <View style={styles.progressReadyBlock} testID="break-progress-ready">
          <SizableText style={styles.progressReadyTitle}>✓ 採点完了</SizableText>
          <SizableText style={styles.progressReadySub}>
            次のサイクルのインプットで{'\n'}結果を確認できます。
          </SizableText>
        </View>
      ) : null}
    </View>
  );
}

function NextCycleHourglassAsset() {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const source = Image.resolveAssetSource(NEXT_CYCLE_HOURGLASS_ASSET);
    const uri = source?.uri;
    if (!uri || typeof fetch !== 'function') return;

    fetch(uri)
      .then((response) => {
        if (!response.ok && !(response.status === 0 && uri.startsWith('file://'))) {
          throw new Error(`Failed to load next cycle hourglass SVG: ${response.status}`);
        }
        return response.text();
      })
      .then((loadedXml) => {
        if (isMounted) {
          const xmlWithoutUnsupportedHighlight = loadedXml.replace(
            /\s*<rect class="cls-10" x="-9\.33" y="-28\.16" width="67\.08" height="107\.05"\/>/g,
            '',
          );
          setXml(
            inlineSvgClassStyles(xmlWithoutUnsupportedHighlight, {
              attributeNames: NEXT_CYCLE_SVG_STYLE_ATTRIBUTE_NAMES,
              unsupportedProperties: NEXT_CYCLE_SVG_UNSUPPORTED_STYLE_PROPERTIES,
            }),
          );
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

  const fallback = <HourglassGraphic size={220} strokeColor={INPUT_COLOR} />;

  if (!xml) return fallback;

  return (
    <SvgXml
      xml={xml}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      fallback={fallback}
      onError={() => undefined}
    />
  );
}

type NextCycleReadyViewProps = {
  isStarting: boolean;
  hasStartError: boolean;
  onStart: () => void;
  onCancel: () => void;
};

function TurnArrow() {
  return (
    <Svg width={92} height={120} viewBox="0 0 92 120" fill="none">
      <Path
        d="M58 10 C70 43 62 76 31 95"
        stroke="#2F2F2F"
        strokeWidth={14}
        strokeLinecap="butt"
        fill="none"
      />
      <Path d="M27 71 L28 108 L60 89 Z" fill="#2F2F2F" />
    </Svg>
  );
}

function NextCycleReadyView({
  isStarting,
  hasStartError,
  onStart,
  onCancel,
}: NextCycleReadyViewProps) {
  const { height: windowHeight } = useWindowDimensions();
  const isCompactHeight = windowHeight < 820;
  const hourglassHeight = isCompactHeight ? 258 : 286;
  const hourglassWidth = hourglassHeight / NEXT_CYCLE_HOURGLASS_ASPECT_RATIO;
  const { handleRotationAreaLayout, hourglassRotationStyle, rotationResponder } =
    useNextCycleRotation({ isStarting, onStart });

  return (
    <View style={styles.nextReadyContent} testID="break-next-cycle-view">
      <View
        accessibilityLabel="砂時計を回して次のインプットを開始"
        onLayout={handleRotationAreaLayout}
        style={styles.nextReadyRotationArea}
        testID="break-next-cycle-rotation-area"
        {...rotationResponder.panHandlers}
      >
        <SizableText style={styles.nextReadyTitle}>
          砂時計を回して次のサイクルを回そう！
        </SizableText>

        <View
          style={[
            styles.nextReadyGraphicArea,
            isCompactHeight ? styles.nextReadyGraphicAreaCompact : null,
          ]}
        >
          <View
            style={[styles.nextHourglassButton, isStarting ? styles.buttonDisabled : null]}
            testID="break-next-cycle-hourglass"
          >
            <Animated.View
              style={[
                styles.nextCycleHourglassAsset,
                {
                  width: hourglassWidth,
                  height: hourglassHeight,
                  transform: [{ rotate: hourglassRotationStyle }],
                },
              ]}
            >
              <NextCycleHourglassAsset />
            </Animated.View>
            {isStarting ? (
              <View style={styles.nextStartingOverlay}>
                <Spinner color={INPUT_COLOR} />
              </View>
            ) : null}
          </View>

          <View style={styles.turnArrow}>
            <TurnArrow />
          </View>
        </View>

        <SizableText style={styles.nextReadyDescription}>
          回すと次のインプットがスタートします。{'\n'}
          スタート後、アウトプットの評価を見ることができます。
        </SizableText>
      </View>

      <View style={styles.nextReadyBottom}>
        {hasStartError ? (
          <SizableText style={styles.errorText} testID="break-next-cycle-error">
            次のサイクルを開始できませんでした。通信環境を確認してもう一度お試しください。
          </SizableText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.abortButton, pressed ? styles.buttonPressed : null]}
          testID="break-next-cycle-cancel"
        >
          <SizableText style={styles.abortButtonText}>中断する</SizableText>
        </Pressable>
      </View>
    </View>
  );
}

type SessionRouteParams = {
  id?: string;
  input?: string;
  output?: string;
  break?: string;
};

export function BreakScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const inputMinutes = Number(params.input) || DEFAULT_TIMER.input_minutes;
  const outputMinutes = Number(params.output) || DEFAULT_TIMER.output_minutes;
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const isFocused = useIsFocused();
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const incrementLoop = useLoopStore((s) => s.incrementLoop);
  const [screenMode, setScreenMode] = useState<BreakScreenMode>('resting');

  const judgmentQuery = useJudgment(sessionId);
  const isJudgmentReady = judgmentQuery.data?.kind === 'ready';

  const smoothRemainingSeconds = useSmoothRemainingSeconds();
  const totalSeconds = useTimerStore((s) => s.totalSeconds);
  const elapsedRatio =
    totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - smoothRemainingSeconds / totalSeconds)) : 0;
  const pendingProgress = Math.round(
    PROGRESS_PENDING_MIN + elapsedRatio * (PROGRESS_PENDING_MAX - PROGRESS_PENDING_MIN),
  );
  const progressPercent = isJudgmentReady ? 100 : pendingProgress;

  const { start, reset } = useTimer({
    enabled: isFocused && screenMode === 'resting',
    onComplete: () => {
      setScreenMode('completed');
    },
  });

  const createNextCycle = useMutation<Session, Error, CreateSessionInput>({
    mutationFn: createSession,
    onSuccess: (session) => {
      reset();
      incrementLoop();
      router.push({
        pathname: '/session/[id]/input',
        params: {
          id: session.id,
          input: String(session.input_minutes),
          output: String(session.output_minutes),
          break: String(session.break_minutes),
        },
      });
    },
  });

  useEffect(() => {
    setScreenMode('resting');
    start('break', breakMinutes * 60);
    return () => {
      reset();
    };
  }, [breakMinutes, reset, sessionId, start]);

  const handleStartNextCycle = () => {
    if (createNextCycle.isPending) return;
    createNextCycle.mutate({
      subject: '未設定',
      topic: '未設定',
      input_minutes: inputMinutes,
      output_minutes: outputMinutes,
      break_minutes: breakMinutes,
    });
  };

  const handleCancelNextCycle = () => {
    reset();
    router.replace('/(tabs)');
  };

  const captionText = isJudgmentReady
    ? '休憩後次のサイクルを回すか決めることができます。'
    : 'AI採点中です。ゆっくり休憩してください。';

  const isNextCycleMode = screenMode === 'nextCycle';
  const usesCompletedPhasePalette = screenMode === 'completed' || isNextCycleMode;
  const displayedPhase = usesCompletedPhasePalette ? null : CURRENT_PHASE;
  const phaseActiveColor = BREAK_COLOR;
  const displayedLoop = isNextCycleMode ? Math.min(currentLoop + 1, LOOP_COUNT_MAX) : currentLoop;
  const completedPhaseColors = usesCompletedPhasePalette ? COMPLETED_PHASE_COLORS : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="break-root">
        <SessionSettingsButton
          onPress={() => router.push(SETTINGS_ROUTE)}
          testID="break-settings-button"
        />

        <View style={styles.badgeStack}>
          <HourglassBadge
            currentLoop={displayedLoop}
            testIDPrefix="break"
            borderColor={BORDER_COLOR}
            marginBottom={0}
          />
        </View>

        <PhaseTabs
          activePhase={displayedPhase}
          testIDPrefix="break"
          activeDotColor={phaseActiveColor}
          activeTextColor={TEXT_ACTIVE}
          inactiveDotFilled={usesCompletedPhasePalette}
          inactiveDotColor={DOT_INACTIVE}
          inactiveDotColors={completedPhaseColors}
          inactiveTextColors={completedPhaseColors}
          marginBottom={isNextCycleMode ? 18 : 20}
        />

        {screenMode === 'resting' ? (
          <>
            <View style={styles.timerStage}>
              <CircularPhaseTimer
                phase={CURRENT_PHASE}
                primaryColor={BREAK_COLOR}
                trackColor={BORDER_COLOR}
                testID="break-circular-timer"
              />
              <SizableText style={styles.timerCaption} testID="break-timer-caption">
                {captionText}
              </SizableText>
            </View>

            <JudgingProgressCard progressPercent={progressPercent} isReady={isJudgmentReady} />
          </>
        ) : screenMode === 'completed' ? (
          <BreakCompletedView
            currentLoop={currentLoop}
            onNextCycle={() => setScreenMode('nextCycle')}
          />
        ) : (
          <NextCycleReadyView
            isStarting={createNextCycle.isPending}
            hasStartError={createNextCycle.isError}
            onStart={handleStartNextCycle}
            onCancel={handleCancelNextCycle}
          />
        )}
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
  badgeStack: {
    alignSelf: 'center',
    alignItems: 'center',
    width: 300,
    marginBottom: 20,
  },
  timerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  timerCaption: {
    color: CAPTION_COLOR,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  progressCard: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: PROGRESS_CARD_BG,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressHeaderLabel: {
    color: PROGRESS_CARD_TEXT,
    fontSize: 13,
    fontWeight: '600',
  },
  progressHeaderPercent: {
    color: PROGRESS_CARD_TEXT,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: PROGRESS_TRACK_COLOR,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: PROGRESS_FILL_COLOR,
  },
  progressReadyBlock: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  progressReadyTitle: {
    color: PROGRESS_CARD_TEXT,
    fontSize: 15,
    fontWeight: '700',
  },
  progressReadySub: {
    color: PROGRESS_CARD_SUBTEXT,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  nextReadyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  nextReadyRotationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  nextReadyTitle: {
    color: TEXT_ACTIVE,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    textAlign: 'center',
  },
  nextReadyGraphicArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 280,
    marginTop: 12,
  },
  nextReadyGraphicAreaCompact: {
    minHeight: 252,
    marginTop: 10,
  },
  nextHourglassButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextCycleHourglassAsset: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStartingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
  },
  turnArrow: {
    position: 'absolute',
    right: 24,
    bottom: 48,
  },
  nextReadyBottom: {
    alignItems: 'center',
    width: '100%',
    gap: 14,
  },
  nextReadyDescription: {
    color: '#9B9B9B',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  abortButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 62,
    borderWidth: 1.5,
    borderColor: '#777777',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  abortButtonText: {
    color: '#777777',
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 25,
  },
  errorText: {
    color: ERROR_COLOR,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonDisabled: {
    opacity: 0.58,
  },
});

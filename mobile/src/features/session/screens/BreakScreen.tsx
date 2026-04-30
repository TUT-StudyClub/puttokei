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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { SizableText } from 'tamagui';

import { createSession } from '@/features/session/api/sessionApi';
import { BreakCompletedView } from '@/features/session/components/BreakCompletedView';
import { NextCycleReadyView } from '@/features/session/components/NextCycleReadyView';
import {
  CircularPhaseTimer,
  HourglassBadge,
  type HourglassSandLayer,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
} from '@/features/session/components/SessionPhaseChrome';
import {
  DEFAULT_TIMER,
  HOURGLASS_BREAK_SAND_OPACITY,
  HOURGLASS_SAND_COLORS,
} from '@/features/session/config';
import { useJudgment } from '@/features/session/hooks/useJudgment';
import {
  useSmoothRemainingSeconds,
  useThrottledRemainingSeconds,
  useTimer,
} from '@/features/session/hooks/useTimer';
import type { CreateSessionInput, Session } from '@/features/session/types';
import { APP_COLORS } from '@/shared/lib/colors';
import { useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;

const CURRENT_PHASE: SessionPhase = 'break';

const BREAK_COLOR = APP_COLORS.textInactive;
const TEXT_ACTIVE = APP_COLORS.textPrimary;
const DOT_INACTIVE = APP_COLORS.dotInactive;
const BORDER_COLOR = APP_COLORS.border;
const CAPTION_COLOR = APP_COLORS.textMuted;

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
  const resetLoop = useLoopStore((s) => s.reset);
  const [screenMode, setScreenMode] = useState<BreakScreenMode>('resting');
  const activeBadgeIconRef = useRef<View>(null);
  const badgeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [entranceOrigin, setEntranceOrigin] = useState<{ x: number; y: number } | null>(null);

  const judgmentQuery = useJudgment(sessionId);
  const isJudgmentReady = judgmentQuery.data?.kind === 'ready';

  const smoothRemainingSeconds = useSmoothRemainingSeconds();
  const totalSeconds = useTimerStore((s) => s.totalSeconds);
  const timerStatus = useTimerStore((s) => s.status);
  const throttledRemainingSeconds = useThrottledRemainingSeconds(100);
  const elapsedRatio =
    totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - smoothRemainingSeconds / totalSeconds)) : 0;
  const pendingProgress = Math.round(
    PROGRESS_PENDING_MIN + elapsedRatio * (PROGRESS_PENDING_MAX - PROGRESS_PENDING_MIN),
  );
  const progressPercent = isJudgmentReady ? 100 : pendingProgress;
  const hourglassSandProgress =
    screenMode === 'resting' && totalSeconds > 0
      ? Math.min(1, Math.max(0, throttledRemainingSeconds / totalSeconds))
      : 0;
  const hourglassSandLayers = useMemo<readonly HourglassSandLayer[]>(
    () => [
      { label: 'input', color: HOURGLASS_SAND_COLORS.input, weight: inputMinutes, progress: 0 },
      { label: 'output', color: HOURGLASS_SAND_COLORS.output, weight: outputMinutes, progress: 0 },
      {
        label: 'break',
        color: HOURGLASS_SAND_COLORS.break,
        weight: breakMinutes,
        progress: hourglassSandProgress,
        opacity: HOURGLASS_BREAK_SAND_OPACITY,
      },
    ],
    [inputMinutes, outputMinutes, breakMinutes, hourglassSandProgress],
  );
  const effectiveSandLayers: readonly HourglassSandLayer[] =
    screenMode === 'nextCycle' ? [] : hourglassSandLayers;
  const showSandStream = screenMode === 'resting' && timerStatus === 'running';

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
    resetLoop();
    router.replace('/(tabs)');
  };

  const measureActiveBadgeOrigin = useCallback(() => {
    let measuredOrigin: { x: number; y: number } | null = null;
    activeBadgeIconRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) {
        const origin = { x: x + w / 2, y: y + h / 2 };
        measuredOrigin = origin;
        badgeOriginRef.current = origin;
      }
    });

    return measuredOrigin ?? badgeOriginRef.current;
  }, []);

  const handleBadgeStackLayout = useCallback(() => {
    measureActiveBadgeOrigin();
  }, [measureActiveBadgeOrigin]);

  const handleEnterNextCycle = useCallback(() => {
    setEntranceOrigin(measureActiveBadgeOrigin());
    setScreenMode('nextCycle');
  }, [measureActiveBadgeOrigin]);

  const captionText = isJudgmentReady
    ? '休憩後次のサイクルを回すか決めることができます。'
    : 'AI採点中です。ゆっくり休憩してください。';

  const isNextCycleMode = screenMode === 'nextCycle';
  const usesCompletedPhasePalette = screenMode === 'completed' || isNextCycleMode;
  const displayedPhase = usesCompletedPhasePalette ? null : CURRENT_PHASE;
  const phaseActiveColor = BREAK_COLOR;
  const displayedLoop = currentLoop;
  const completedPhaseColors = usesCompletedPhasePalette ? COMPLETED_PHASE_COLORS : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="break-root">
        <SessionSettingsButton
          onPress={() => router.push(SETTINGS_ROUTE)}
          testID="break-settings-button"
        />

        <View style={styles.badgeStack} onLayout={handleBadgeStackLayout}>
          <HourglassBadge
            currentLoop={displayedLoop}
            testIDPrefix="break"
            borderColor={BORDER_COLOR}
            marginBottom={0}
            variant="blue"
            sandLayers={effectiveSandLayers}
            activeLayerIndex={2}
            showSandStream={showSandStream}
            activeIconRef={activeBadgeIconRef}
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
          <BreakCompletedView currentLoop={currentLoop} onNextCycle={handleEnterNextCycle} />
        ) : (
          <NextCycleReadyView
            isStarting={createNextCycle.isPending}
            hasStartError={createNextCycle.isError}
            onStart={handleStartNextCycle}
            onCancel={handleCancelNextCycle}
            entranceOrigin={entranceOrigin}
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
});

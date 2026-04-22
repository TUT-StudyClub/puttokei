/**
 * 休憩フェーズ画面 (S-07 / S-08-2)。
 *
 * 状態機械上は `judging` に相当 (判定待ちの期間を UI 上は「休憩」として扱う)。
 * 画面は Input / Output と同じ骨格 (設定アイコン + 砂時計バッジ + フェーズタブ +
 * 円形タイマー + 下部カード) で構成し、下部カードに AI 採点の進捗を表示する。
 *
 * 進捗表示は backend から割合を取得できないため、休憩タイマーの経過に合わせて
 * 12% → 90% まで連動させ、判定が ready になった瞬間に 100% に切り替える。
 * タイマー完了時は従来どおり結果画面へ `router.replace` する。
 */
import { useIsFocused } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import { DEFAULT_TIMER } from '@/features/session/config';
import { formatMmSs, useSmoothRemainingSeconds, useTimer } from '@/features/session/hooks/useTimer';
import { useJudgment } from '@/features/session/hooks/useJudgment';
import { LOOP_COUNT_MAX, useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;

const PHASES = ['input', 'output', 'break'] as const;
type Phase = (typeof PHASES)[number];

const PHASE_LABELS: Record<Phase, string> = {
  input: 'インプット',
  output: 'アウトプット',
  break: '休憩',
};

const CURRENT_PHASE: Phase = 'break';

// 休憩フェーズはグレー基調。タイマーリングと大きい数字に同じグレーを使う。
const PRIMARY_COLOR = '#9CA3AF';
const TEXT_ACTIVE = '#2F2F2F';
const TEXT_INACTIVE = '#9CA3AF';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';

// 下部の「採点進捗カード」用トークン。濃い背景に青いプログレスバーを乗せる。
const PROGRESS_CARD_BG = '#2A2A2E';
const PROGRESS_CARD_TEXT = '#FFFFFF';
const PROGRESS_CARD_SUBTEXT = '#B5B7BC';
const PROGRESS_TRACK_COLOR = '#4A4A50';
const PROGRESS_FILL_COLOR = '#4B5CFF';

// 採点進捗の下限 / 上限。ready になるまでは 90% で頭打ちにする。
const PROGRESS_PENDING_MIN = 12;
const PROGRESS_PENDING_MAX = 90;

const HOURGLASS_BADGE_COUNT = LOOP_COUNT_MAX;
const HOURGLASS_BADGE_BASE_WIDTH = 18;
const HOURGLASS_BADGE_BASE_HEIGHT = 24;
const HOURGLASS_BADGE_ACTIVE_SCALE = 1.45;
const HOURGLASS_ICON_PATH =
  'M2 2 H14 V4 C14 6.5 11 7.5 11 10 C11 12.5 14 13.5 14 16 V18 H2 V16 C2 13.5 5 12.5 5 10 C5 7.5 2 6.5 2 4 Z';

type HourglassBadgeIconProps = {
  active: boolean;
  testID?: string;
};

function HourglassBadgeIcon({ active, testID }: HourglassBadgeIconProps) {
  const width = active
    ? HOURGLASS_BADGE_BASE_WIDTH * HOURGLASS_BADGE_ACTIVE_SCALE
    : HOURGLASS_BADGE_BASE_WIDTH;
  const height = active
    ? HOURGLASS_BADGE_BASE_HEIGHT * HOURGLASS_BADGE_ACTIVE_SCALE
    : HOURGLASS_BADGE_BASE_HEIGHT;
  const color = active ? PRIMARY_COLOR : TEXT_INACTIVE;
  return (
    <Svg width={width} height={height} viewBox="0 0 16 20" testID={testID}>
      <Path
        d={HOURGLASS_ICON_PATH}
        stroke={color}
        strokeWidth={active ? 1.5 : 1.3}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const SETTINGS_ICON_HEX_PATH = 'M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z';

function SettingsIcon({ size = 26, color = TEXT_ACTIVE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={SETTINGS_ICON_HEX_PATH}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={12} cy={12} r={2.4} stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

type CircularTimerProps = {
  phaseLabel: string;
};

function CircularTimer({ phaseLabel }: CircularTimerProps) {
  const smoothRemainingSeconds = useSmoothRemainingSeconds();
  const totalSeconds = useTimerStore((s) => s.totalSeconds);

  const size = 260;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayRemainingSeconds = Math.max(0, Math.ceil(smoothRemainingSeconds));
  // 残り割合。開始時はリング全周が塗られ、残り時間が減るにつれてストロークも短くなる。
  // dashOffset を負にすることで、ギャップが 12 時位置から時計回りに広がる。
  const remainingRatio =
    totalSeconds > 0 ? Math.min(1, Math.max(0, smoothRemainingSeconds / totalSeconds)) : 0;
  const dashOffset = -circumference * (1 - remainingRatio);

  return (
    <View style={[styles.timerWrap, { width: size, height: size }]} testID="break-circular-timer">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={BORDER_COLOR}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={PRIMARY_COLOR}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.timerCenter} pointerEvents="none">
        <SizableText style={styles.timerPhaseLabel}>{phaseLabel}</SizableText>
        <SizableText style={styles.timerText} testID="timer-display">
          {formatMmSs(displayRemainingSeconds)}
        </SizableText>
      </View>
    </View>
  );
}

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
  break?: string;
};

export function BreakScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const isFocused = useIsFocused();
  const currentLoop = useLoopStore((s) => s.currentLoop);

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
    enabled: isFocused,
    onComplete: () => {
      router.replace({
        pathname: '/session/[id]/result',
        params: { id: sessionId },
      });
    },
  });

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start('break', breakMinutes * 60);
    return () => {
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captionText = isJudgmentReady
    ? '休憩後次のサイクルを回すか決めることができます。'
    : 'AI採点中です。ゆっくり休憩してください。';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="break-root">
        <View style={styles.settingsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="設定"
            onPress={() => router.push(SETTINGS_ROUTE)}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed ? styles.settingsButtonPressed : null,
            ]}
            hitSlop={8}
            testID="break-settings-button"
          >
            <SettingsIcon />
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge} testID="break-hourglass-badge">
            {Array.from({ length: HOURGLASS_BADGE_COUNT }).map((_, index) => {
              const isActive = index + 1 === currentLoop;
              return (
                <HourglassBadgeIcon
                  key={index}
                  active={isActive}
                  testID={`break-hourglass-badge-icon-${index + 1}`}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.phaseTabs} testID="break-phase-tabs">
          {PHASES.map((p, index) => {
            const isActive = p === CURRENT_PHASE;
            const isLast = index === PHASES.length - 1;
            return (
              <View key={p} style={styles.phaseTabItemRow}>
                <View style={styles.phaseTab} testID={`break-phase-tab-${p}`}>
                  <View style={[styles.phaseTabDot, isActive ? styles.phaseTabDotActive : null]} />
                  <SizableText
                    size="$3"
                    style={[styles.phaseTabLabel, isActive ? styles.phaseTabLabelActive : null]}
                  >
                    {PHASE_LABELS[p]}
                  </SizableText>
                </View>
                {isLast ? null : <View style={styles.phaseTabSeparator} />}
              </View>
            );
          })}
        </View>

        <View style={styles.timerStage}>
          <CircularTimer phaseLabel={PHASE_LABELS[CURRENT_PHASE]} />
          <SizableText style={styles.timerCaption} testID="break-timer-caption">
            {captionText}
          </SizableText>
        </View>

        <JudgingProgressCard progressPercent={progressPercent} isReady={isJudgmentReady} />
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
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 12,
  },
  settingsButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonPressed: {
    opacity: 0.6,
  },
  badgeRow: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  phaseTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  phaseTabItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  phaseTabDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: DOT_INACTIVE,
    backgroundColor: 'transparent',
  },
  phaseTabDotActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: PRIMARY_COLOR,
  },
  phaseTabLabel: {
    color: DOT_INACTIVE,
    fontSize: 14,
    fontWeight: '600',
  },
  phaseTabLabelActive: {
    color: TEXT_ACTIVE,
    fontWeight: '700',
  },
  phaseTabSeparator: {
    width: 16,
    height: 1.5,
    marginHorizontal: 6,
    backgroundColor: DOT_INACTIVE,
  },
  timerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timerPhaseLabel: {
    color: PRIMARY_COLOR,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  timerText: {
    color: PRIMARY_COLOR,
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 64,
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

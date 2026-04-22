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
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { SizableText } from 'tamagui';

import {
  CircularPhaseTimer,
  HourglassBadge,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useSmoothRemainingSeconds, useTimer } from '@/features/session/hooks/useTimer';
import { useJudgment } from '@/features/session/hooks/useJudgment';
import { useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;

const CURRENT_PHASE: SessionPhase = 'break';

// 休憩フェーズはグレー基調。タイマーリングと大きい数字に同じグレーを使う。
const PRIMARY_COLOR = '#9CA3AF';
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
        <SessionSettingsButton
          onPress={() => router.push(SETTINGS_ROUTE)}
          testID="break-settings-button"
        />

        <HourglassBadge
          currentLoop={currentLoop}
          testIDPrefix="break"
          activeColor={PRIMARY_COLOR}
          inactiveColor={TEXT_INACTIVE}
          borderColor={BORDER_COLOR}
        />

        <PhaseTabs
          activePhase={CURRENT_PHASE}
          testIDPrefix="break"
          activeDotColor={PRIMARY_COLOR}
          inactiveDotColor={DOT_INACTIVE}
        />

        <View style={styles.timerStage}>
          <CircularPhaseTimer
            phase={CURRENT_PHASE}
            primaryColor={PRIMARY_COLOR}
            trackColor={BORDER_COLOR}
            testID="break-circular-timer"
          />
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

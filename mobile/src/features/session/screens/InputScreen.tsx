/**
 * インプットフェーズ画面。
 *
 * マウント時に `useTimer.start('input', input_minutes * 60)` でカウントダウンを開始し、
 * タイマー完了時に `PATCH status=output` を送る。成功後に `/session/{id}/output` へ
 * `router.replace` で遷移する（history に残さない方針）。
 *
 * 画面構成は HomeScreen と揃えた上で、中央に円形プログレス、下部に「中断する」
 * 「5分延長」の 2 ボタンを配置する。
 */
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import { DEFAULT_TIMER } from '@/features/session/config';
import { formatMmSs, useTimer } from '@/features/session/hooks/useTimer';
import { useUpdateSessionStatus } from '@/features/session/hooks/useUpdateSessionStatus';
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

const CURRENT_PHASE: Phase = 'input';
const EXTEND_MINUTES = 5;

const PRIMARY_COLOR = '#4B5CFF';
const TEXT_ACTIVE = '#2F2F2F';
const TEXT_INACTIVE = '#9CA3AF';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';

// 砂時計バッジ (HomeScreen と同じアイコンパスを使用)
const HOURGLASS_BADGE_COUNT = LOOP_COUNT_MAX;
const HOURGLASS_BADGE_BASE_WIDTH = 18;
const HOURGLASS_BADGE_BASE_HEIGHT = 24;
const HOURGLASS_BADGE_ACTIVE_SCALE = 1.45;
const HOURGLASS_BADGE_INACTIVE_COLOR = TEXT_INACTIVE;
const HOURGLASS_BADGE_ACTIVE_COLOR = PRIMARY_COLOR;
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
  const color = active ? HOURGLASS_BADGE_ACTIVE_COLOR : HOURGLASS_BADGE_INACTIVE_COLOR;
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
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds);
  const totalSeconds = useTimerStore((s) => s.totalSeconds);

  const size = 260;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // 経過割合。経過分だけ progress ストロークが伸びる (12 時方向から時計回り)。
  const progressRatio =
    totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds)) : 0;
  const dashOffset = circumference * (1 - progressRatio);

  return (
    <View
      style={[styles.timerWrap, { width: size, height: size }]}
      testID="input-circular-timer"
    >
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
          {formatMmSs(remainingSeconds)}
        </SizableText>
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

export function InputScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const inputMinutes = Number(params.input) || DEFAULT_TIMER.input_minutes;
  const outputMinutes = Number(params.output) || DEFAULT_TIMER.output_minutes;
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const updateStatus = useUpdateSessionStatus();
  const cancelMutation = useUpdateSessionStatus();
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const extendTimer = useTimerStore((s) => s.extend);
  const timerStatus = useTimerStore((s) => s.status);

  const { start, reset } = useTimer({
    onComplete: () => {
      updateStatus.mutate(
        { sessionId, status: 'output' },
        {
          onSuccess: () => {
            router.replace({
              pathname: '/session/[id]/output',
              params: {
                id: sessionId,
                output: String(outputMinutes),
                break: String(breakMinutes),
              },
            });
          },
        },
      );
    },
  });

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start('input', inputMinutes * 60);
    return () => {
      reset();
    };
    // 依存を意図的に空にしている: start/reset が参照として安定しているうえ、
    // startedRef で二重 start を防いでいるため再実行は不要。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            testID="input-settings-button"
          >
            <SettingsIcon />
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge} testID="input-hourglass-badge">
            {Array.from({ length: HOURGLASS_BADGE_COUNT }).map((_, index) => {
              const isActive = index + 1 === currentLoop;
              return (
                <HourglassBadgeIcon
                  key={index}
                  active={isActive}
                  testID={`input-hourglass-badge-icon-${index + 1}`}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.phaseTabs} testID="input-phase-tabs">
          {PHASES.map((p, index) => {
            const isActive = p === CURRENT_PHASE;
            const isLast = index === PHASES.length - 1;
            return (
              <View key={p} style={styles.phaseTabItemRow}>
                <View style={styles.phaseTab} testID={`input-phase-tab-${p}`}>
                  <View
                    style={[styles.phaseTabDot, isActive ? styles.phaseTabDotActive : null]}
                  />
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
          <SizableText style={styles.timerCaption} testID="input-timer-caption">
            終了後{outputMinutes}分間でアウトプットです{'\n'}アウトプットへは自動で切り替わります
          </SizableText>
        </View>

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
    marginBottom: 24,
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

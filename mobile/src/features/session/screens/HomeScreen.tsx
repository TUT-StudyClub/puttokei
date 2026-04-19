/**
 * ホーム画面 (タイマー)。
 *
 * チュートリアル直後に到達する画面。インプット / アウトプット / 休憩 のフェーズを切り替えて
 * デフォルト時間を確認し、「スタート」でセッションを開始する。
 *
 * 科目 (subject) / トピック (topic) の入力フローは未実装のため、
 * 当面はプレースホルダー値で createSession を呼ぶ。後続タスクで入力 UI を追加する想定。
 */
import { type Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';
import { SizableText, Spinner } from 'tamagui';

import { DEFAULT_TIMER } from '@/features/session/config';
import { useCreateSession } from '@/features/session/hooks/useCreateSession';
import { LOOP_COUNT_MAX, useLoopStore } from '@/shared/stores/loopStore';

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;

const PHASES = ['input', 'output', 'break'] as const;
type Phase = (typeof PHASES)[number];

const PHASE_LABELS: Record<Phase, string> = {
  input: 'インプット',
  output: 'アウトプット',
  break: '休憩',
};

const PHASE_MINUTES: Record<Phase, number> = {
  input: DEFAULT_TIMER.input_minutes,
  output: DEFAULT_TIMER.output_minutes,
  break: DEFAULT_TIMER.break_minutes,
};

const HOURGLASS_BADGE_COUNT = LOOP_COUNT_MAX;
const HOURGLASS_BADGE_BASE_WIDTH = 18;
const HOURGLASS_BADGE_BASE_HEIGHT = 24;
const HOURGLASS_BADGE_ACTIVE_SCALE = 1.45;
const HOURGLASS_BADGE_COLOR = '#9CA3AF';

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
  return (
    <Svg width={width} height={height} viewBox="0 0 16 20" testID={testID}>
      <Path
        d={HOURGLASS_ICON_PATH}
        stroke={HOURGLASS_BADGE_COLOR}
        strokeWidth={active ? 1.5 : 1.3}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// 六角形 + 中央の小円で構成した設定アイコン
const SETTINGS_ICON_HEX_PATH =
  'M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z';

function SettingsIcon({ size = 26, color = '#2F2F2F' }: { size?: number; color?: string }) {
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

function formatMinutes(minutes: number) {
  return `${String(minutes).padStart(2, '0')}:00`;
}

export function HomeScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('input');
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const createSession = useCreateSession();

  const handleStart = () => {
    if (createSession.isPending) return;
    // TODO: subject / topic 入力 UI を追加して、ユーザー入力を渡す。
    // 当面はデフォルト値でセッションを作成して input 画面に遷移する。
    createSession.mutate({
      subject: '未設定',
      topic: '未設定',
      input_minutes: DEFAULT_TIMER.input_minutes,
      output_minutes: DEFAULT_TIMER.output_minutes,
      break_minutes: DEFAULT_TIMER.break_minutes,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="home-root">
        <View style={styles.settingsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="設定"
            onPress={() => router.push(SETTINGS_ROUTE)}
            style={({ pressed }) => [styles.settingsButton, pressed ? styles.settingsButtonPressed : null]}
            hitSlop={8}
            testID="home-settings-button"
          >
            <SettingsIcon />
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge} testID="home-hourglass-badge">
            {Array.from({ length: HOURGLASS_BADGE_COUNT }).map((_, index) => {
              // currentLoop は 1 始まり。N ループ目は左から N 番目を強調する。
              const isActive = index + 1 === currentLoop;
              return (
                <HourglassBadgeIcon
                  key={index}
                  active={isActive}
                  testID={`home-hourglass-badge-icon-${index + 1}`}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.phaseTabs} testID="home-phase-tabs">
          {PHASES.map((p, index) => {
            const isActive = p === phase;
            const isLast = index === PHASES.length - 1;
            return (
              <View key={p} style={styles.phaseTabItemRow}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setPhase(p)}
                  style={styles.phaseTab}
                  testID={`home-phase-tab-${p}`}
                >
                  <View
                    style={[
                      styles.phaseTabDot,
                      isActive ? styles.phaseTabDotActive : null,
                    ]}
                  />
                  <SizableText
                    size="$3"
                    style={[styles.phaseTabLabel, isActive ? styles.phaseTabLabelActive : null]}
                  >
                    {PHASE_LABELS[p]}
                  </SizableText>
                </Pressable>
                {isLast ? null : <View style={styles.phaseTabSeparator} />}
              </View>
            );
          })}
        </View>

        <View style={styles.timerStage}>
          <View style={styles.timerCircle} testID="home-timer-circle">
            <SizableText style={styles.timerText} testID="home-timer-text">
              {formatMinutes(PHASE_MINUTES[phase])}
            </SizableText>
          </View>
          <SizableText style={styles.timerCaption} testID="home-timer-caption">
            まずは20分間勉強してみましょう{'\n'}集中できなくても大丈夫です
          </SizableText>
        </View>

        <View style={styles.actionArea}>
          {createSession.error ? (
            <SizableText style={styles.errorText} size="$3">
              セッションの開始に失敗しました。通信環境を確認してもう一度お試しください。
            </SizableText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={createSession.isPending}
            onPress={handleStart}
            style={({ pressed }) => [
              styles.startButton,
              pressed ? styles.startButtonPressed : null,
              createSession.isPending ? styles.startButtonDisabled : null,
            ]}
            testID="home-start-button"
          >
            {createSession.isPending ? (
              <Spinner color="#FFFFFF" />
            ) : (
              <SizableText style={styles.startButtonText}>スタート</SizableText>
            )}
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
  badgeRow: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    marginBottom: 36,
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
    borderColor: '#D9D9D9',
    backgroundColor: 'transparent',
  },
  phaseTabDotActive: {
    borderColor: '#9CA3AF',
  },
  phaseTabLabel: {
    color: '#D9D9D9',
    fontSize: 14,
    fontWeight: '600',
  },
  phaseTabLabelActive: {
    color: '#2F2F2F',
    fontWeight: '700',
  },
  phaseTabSeparator: {
    width: 16,
    height: 1.5,
    marginHorizontal: 6,
    backgroundColor: '#D9D9D9',
  },
  timerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  timerCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 4,
    borderColor: '#D9D9D9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    color: '#D9D9D9',
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 64,
  },
  timerCaption: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  actionArea: {
    gap: 12,
  },
  errorText: {
    color: '#D92D20',
    textAlign: 'center',
  },
  startButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 18,
    backgroundColor: '#4B5CFF',
  },
  startButtonPressed: {
    opacity: 0.92,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
});

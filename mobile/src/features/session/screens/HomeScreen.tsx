/**
 * ホーム画面 (タイマー)。
 *
 * チュートリアル直後に到達する画面。インプット / アウトプット / 休憩 のフェーズを切り替えて
 * デフォルト時間を確認し、「スタート」でセッションを開始する。
 *
 * 科目 (subject) / トピック (topic) の入力フローは未実装のため、
 * 当面はプレースホルダー値で createSession を呼ぶ。後続タスクで入力 UI を追加する想定。
 */
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { Defs, LinearGradient, Path, Stop, Svg } from 'react-native-svg';
import { SizableText, Spinner } from 'tamagui';

import { DEFAULT_TIMER } from '@/features/session/config';
import { useCreateSession } from '@/features/session/hooks/useCreateSession';

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

const HOURGLASS_BADGE_COUNT = 8;

const HOURGLASS_ICON_PATH =
  'M2 2 H14 V4 C14 6.5 11 7.5 11 10 C11 12.5 14 13.5 14 16 V18 H2 V16 C2 13.5 5 12.5 5 10 C5 7.5 2 6.5 2 4 Z';

function HourglassBadgeIcon() {
  return (
    <Svg width={14} height={18} viewBox="0 0 16 20">
      <Defs>
        <LinearGradient id="badgeHourglass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7C8BFF" />
          <Stop offset="1" stopColor="#4B5CFF" />
        </LinearGradient>
      </Defs>
      <Path
        d={HOURGLASS_ICON_PATH}
        stroke="url(#badgeHourglass)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function formatMinutes(minutes: number) {
  return `${String(minutes).padStart(2, '0')}:00`;
}

export function HomeScreen() {
  const [phase, setPhase] = useState<Phase>('input');
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
        <View style={styles.badgeRow}>
          <View style={styles.badge} testID="home-hourglass-badge">
            {Array.from({ length: HOURGLASS_BADGE_COUNT }).map((_, index) => (
              <HourglassBadgeIcon key={index} />
            ))}
          </View>
        </View>

        <View style={styles.phaseTabs} testID="home-phase-tabs">
          {PHASES.map((p) => {
            const isActive = p === phase;
            return (
              <Pressable
                key={p}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setPhase(p)}
                style={styles.phaseTab}
                testID={`home-phase-tab-${p}`}
              >
                <SizableText
                  size="$3"
                  style={[styles.phaseTabLabel, isActive ? styles.phaseTabLabelActive : null]}
                >
                  {PHASE_LABELS[p]}
                </SizableText>
                <View
                  style={[
                    styles.phaseTabUnderline,
                    isActive ? styles.phaseTabUnderlineActive : null,
                  ]}
                />
              </Pressable>
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
            おすすめの時間配分です{'\n'}集中して取り組みましょう
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
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
    gap: 8,
    marginBottom: 36,
  },
  phaseTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  phaseTabLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  phaseTabLabelActive: {
    color: '#2F2F2F',
  },
  phaseTabUnderline: {
    width: '60%',
    height: 2,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  phaseTabUnderlineActive: {
    backgroundColor: '#4B5CFF',
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
    borderWidth: 1.5,
    borderColor: '#D9D9D9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    color: '#2F2F2F',
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

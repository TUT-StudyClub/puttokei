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
import { SizableText, Spinner } from 'tamagui';

import {
  HourglassBadge,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useCreateSession } from '@/features/session/hooks/useCreateSession';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useLoopStore } from '@/shared/stores/loopStore';

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;

const HOURGLASS_BADGE_COLOR = '#9CA3AF';
const TEXT_ACTIVE = '#2F2F2F';
const DOT_INACTIVE = '#D9D9D9';

function formatMinutes(minutes: number) {
  return `${String(minutes).padStart(2, '0')}:00`;
}

export function HomeScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<SessionPhase>('input');
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const createSession = useCreateSession();
  const settingsQuery = useSettings();

  // ユーザー設定が取れていればその値を、まだロード中 / 未ログインなら DEFAULT_TIMER を使う。
  // 設定画面で更新すると useUpdateSettings が SETTINGS_QUERY_KEY のキャッシュを書き換えるため、
  // 次回 HomeScreen を開いたタイミングでフェーズタブに即反映される。
  const phaseMinutes: Record<SessionPhase, number> = {
    input: settingsQuery.data?.input_minutes ?? DEFAULT_TIMER.input_minutes,
    output: settingsQuery.data?.output_minutes ?? DEFAULT_TIMER.output_minutes,
    break: settingsQuery.data?.break_minutes ?? DEFAULT_TIMER.break_minutes,
  };

  const handleStart = () => {
    if (createSession.isPending) return;
    // TODO: subject / topic 入力 UI を追加して、ユーザー入力を渡す。
    // 当面はユーザー設定 (未取得時は DEFAULT_TIMER) でセッションを作成して input 画面に遷移する。
    createSession.mutate({
      subject: '未設定',
      topic: '未設定',
      input_minutes: phaseMinutes.input,
      output_minutes: phaseMinutes.output,
      break_minutes: phaseMinutes.break,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="home-root">
        <SessionSettingsButton
          onPress={() => router.push(SETTINGS_ROUTE)}
          testID="home-settings-button"
        />

        <HourglassBadge currentLoop={currentLoop} testIDPrefix="home" marginBottom={24} />

        <PhaseTabs
          activePhase={phase}
          testIDPrefix="home"
          activeDotColor={HOURGLASS_BADGE_COLOR}
          activeDotFilled={false}
          activeTextColor={TEXT_ACTIVE}
          inactiveTextColor={DOT_INACTIVE}
          inactiveDotColor={DOT_INACTIVE}
          marginBottom={36}
          onChange={setPhase}
        />

        <View style={styles.timerStage}>
          <View style={styles.timerCircle} testID="home-timer-circle">
            <SizableText style={styles.timerText} testID="home-timer-text">
              {formatMinutes(phaseMinutes[phase])}
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

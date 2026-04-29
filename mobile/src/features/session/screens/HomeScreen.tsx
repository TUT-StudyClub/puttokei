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

        <View style={styles.badgeWrapper}>
          <HourglassBadge
            currentLoop={currentLoop}
            testIDPrefix="home"
            activeColor={HOURGLASS_BADGE_COLOR}
            inactiveColor={HOURGLASS_BADGE_COLOR}
            marginBottom={0}
            rowStyle={styles.badgeRowOverride}
          />
        </View>

        <View style={styles.phaseTabsWrapper}>
          <PhaseTabs
            activePhase={phase}
            testIDPrefix="home"
            activeDotColor={HOURGLASS_BADGE_COLOR}
            activeDotFilled={false}
            activeTextColor="#9D9D9D"
            inactiveTextColor="#CDCDCD"
            inactiveDotColor={DOT_INACTIVE}
            marginBottom={0}
            onChange={setPhase}
          />
        </View>

        <View style={styles.timerCircle} testID="home-timer-circle">
          <SizableText style={styles.timerText} testID="home-timer-text">
            {formatMinutes(phaseMinutes[phase])}
          </SizableText>
        </View>

        <SizableText style={styles.timerCaption} testID="home-timer-caption">
          まずは20分間勉強してみましょう{'\n'}集中できなくても大丈夫です
        </SizableText>

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
  },
  badgeWrapper: {
    position: 'absolute',
    top: '7.9%',
    left: '13.18%',
    right: '12.94%',
    alignItems: 'flex-start',
  },
  badgeRowOverride: {
    marginTop: 0,
  },
  phaseTabsWrapper: {
    position: 'absolute',
    top: '18.6%',
    left: '13.18%',
    right: 0,
  },
  timerCircle: {
    position: 'absolute',
    top: '26.1%',
    left: '13%',
    right: '13%',
    aspectRatio: 1,
    borderRadius: 9999,
    borderWidth: 11,
    borderColor: '#EFEFEF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  timerText: {
    color: '#CDCDCD',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 58,
    lineHeight: 64,
  },
  timerCaption: {
    position: 'absolute',
    top: '71%',
    left: 0,
    right: 0,
    color: '#9D9D9D',
    fontFamily: 'HiraginoSans-W3',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  actionArea: {
    position: 'absolute',
    top: '78.3%',
    left: '13.18%',
    right: '12.94%',
    gap: 12,
  },
  errorText: {
    color: '#D92D20',
    textAlign: 'center',
  },
  startButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 54,
    borderRadius: 20,
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
    fontFamily: 'HiraginoSans-W6',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
});

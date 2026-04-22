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
import { useIsFocused } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { SizableText } from 'tamagui';

import {
  CircularPhaseTimer,
  HourglassBadge,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useTimer } from '@/features/session/hooks/useTimer';
import { useUpdateSessionStatus } from '@/features/session/hooks/useUpdateSessionStatus';
import { useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const SETTINGS_ROUTE = '/(tabs)/settings' as unknown as Href;

const CURRENT_PHASE: SessionPhase = 'input';
const EXTEND_MINUTES = 5;

const PRIMARY_COLOR = '#4B5CFF';
const TEXT_ACTIVE = '#2F2F2F';
const TEXT_INACTIVE = '#9CA3AF';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';

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
  const isFocused = useIsFocused();
  const updateStatus = useUpdateSessionStatus();
  const cancelMutation = useUpdateSessionStatus();
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const extendTimer = useTimerStore((s) => s.extend);
  const timerStatus = useTimerStore((s) => s.status);

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
        <SessionSettingsButton
          onPress={() => router.push(SETTINGS_ROUTE)}
          testID="input-settings-button"
        />

        <HourglassBadge
          currentLoop={currentLoop}
          testIDPrefix="input"
          activeColor={PRIMARY_COLOR}
          inactiveColor={TEXT_INACTIVE}
          borderColor={BORDER_COLOR}
          marginBottom={24}
        />

        <PhaseTabs
          activePhase={CURRENT_PHASE}
          testIDPrefix="input"
          activeDotColor={PRIMARY_COLOR}
          inactiveDotColor={DOT_INACTIVE}
        />

        <View style={styles.timerStage}>
          <CircularPhaseTimer
            phase={CURRENT_PHASE}
            primaryColor={PRIMARY_COLOR}
            trackColor={BORDER_COLOR}
            testID="input-circular-timer"
          />
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

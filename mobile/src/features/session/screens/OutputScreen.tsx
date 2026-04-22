/**
 * アウトプットフェーズ画面。
 *
 * InputScreen と骨格を揃えつつ、タイマー下に「テキスト / 画像 / 音声」の入力方法切替と
 * OutputEditor を配置する。テキスト選択時のみ入力可で、画像 / 音声 は後続タスクまで無効化する。
 *
 * キーボード表示時は KeyboardAvoidingView + ScrollView でコンテンツ全体を上へ
 * スクロールさせ、TextArea が覆われないようにする。
 *
 * タイマー完了時は自動送信せず、ユーザーに明示的な送信を促す。
 */
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import { OutputEditor } from '@/features/session/components/OutputEditor';
import type { OutputEditorSubmitPayload } from '@/features/session/components/OutputEditor';
import { DEFAULT_TIMER } from '@/features/session/config';
import { formatMmSs, useSmoothRemainingSeconds, useTimer } from '@/features/session/hooks/useTimer';
import { useSubmitOutput } from '@/features/session/hooks/useSubmitOutput';
import { isApiError } from '@/shared/lib/api';
import { LOOP_COUNT_MAX, useLoopStore } from '@/shared/stores/loopStore';
import { useTimerStore } from '@/shared/stores/timerStore';

const PHASES = ['input', 'output', 'break'] as const;
type Phase = (typeof PHASES)[number];

const PHASE_LABELS: Record<Phase, string> = {
  input: 'インプット',
  output: 'アウトプット',
  break: '休憩',
};

const CURRENT_PHASE: Phase = 'output';

// ピンク基調 (アウトプットフェーズ用)
const PRIMARY_COLOR = '#EC4899';
const PRIMARY_SOFT_COLOR = '#FBE4EF';
const TEXT_ACTIVE = '#2F2F2F';
const TEXT_INACTIVE = '#9CA3AF';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';

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
  compact?: boolean;
};

function CircularTimer({ phaseLabel, compact = false }: CircularTimerProps) {
  const smoothRemainingSeconds = useSmoothRemainingSeconds();
  const totalSeconds = useTimerStore((s) => s.totalSeconds);

  const size = compact ? 156 : 260;
  const strokeWidth = compact ? 10 : 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayRemainingSeconds = Math.max(0, Math.ceil(smoothRemainingSeconds));
  // 残り割合。開始時はリング全周が塗られ、残り時間が減るにつれてストロークも短くなる。
  // dashOffset を負にすることで、ギャップが 12 時位置から時計回りに広がる。
  const remainingRatio =
    totalSeconds > 0 ? Math.min(1, Math.max(0, smoothRemainingSeconds / totalSeconds)) : 0;
  const dashOffset = -circumference * (1 - remainingRatio);

  return (
    <View style={[styles.timerWrap, { width: size, height: size }]} testID="output-circular-timer">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={PRIMARY_SOFT_COLOR}
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
      <View
        style={[styles.timerCenter, compact ? styles.timerCenterCompact : null]}
        pointerEvents="none"
      >
        <SizableText
          style={[styles.timerPhaseLabel, compact ? styles.timerPhaseLabelCompact : null]}
        >
          {phaseLabel}
        </SizableText>
        <SizableText
          style={[styles.timerText, compact ? styles.timerTextCompact : null]}
          testID="timer-display"
        >
          {formatMmSs(displayRemainingSeconds)}
        </SizableText>
      </View>
    </View>
  );
}

// 入力方法。現時点でテキストのみ実装済みで、画像・音声は後続タスクで対応する。
const INPUT_METHODS = ['text', 'image', 'voice'] as const;
type InputMethod = (typeof INPUT_METHODS)[number];

const INPUT_METHOD_LABELS: Record<InputMethod, string> = {
  text: 'テキスト',
  image: '画像',
  voice: '音声',
};

// 各方法を示すシンプルなラインアイコン。
function InputMethodIcon({ method, color }: { method: InputMethod; color: string }) {
  switch (method) {
    case 'text':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 18 L14 8 L16 10 L6 20 H4 Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M14 8 L17 5 L19 7 L16 10"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'image':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 5 H20 V19 H4 Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx={9} cy={10} r={1.6} stroke={color} strokeWidth={1.6} fill="none" />
          <Path
            d="M5 18 L10 13 L14 16 L17 13 L19 15"
            stroke={color}
            strokeWidth={1.6}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'voice':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 4 C10.3 4 9 5.3 9 7 V12 C9 13.7 10.3 15 12 15 C13.7 15 15 13.7 15 12 V7 C15 5.3 13.7 4 12 4 Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M6 12 C6 15.3 8.7 18 12 18 C15.3 18 18 15.3 18 12"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M12 18 V21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
  }
}

type InputMethodTabsProps = {
  value: InputMethod;
  onChange: (method: InputMethod) => void;
};

function InputMethodTabs({ value, onChange }: InputMethodTabsProps) {
  return (
    <View style={styles.methodTabs} testID="output-method-tabs">
      {INPUT_METHODS.map((method) => {
        const isActive = method === value;
        const color = isActive ? PRIMARY_COLOR : TEXT_INACTIVE;
        return (
          <Pressable
            key={method}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(method)}
            style={[styles.methodTab, isActive ? styles.methodTabActive : null]}
            testID={`output-method-tab-${method}`}
          >
            <InputMethodIcon method={method} color={color} />
            <SizableText
              style={[styles.methodTabLabel, isActive ? styles.methodTabLabelActive : null]}
            >
              {INPUT_METHOD_LABELS[method]}
            </SizableText>
          </Pressable>
        );
      })}
    </View>
  );
}

type SessionRouteParams = {
  id?: string;
  output?: string;
  break?: string;
};

export function OutputScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const outputMinutes = Number(params.output) || DEFAULT_TIMER.output_minutes;
  const breakMinutes = Number(params.break) || DEFAULT_TIMER.break_minutes;

  const router = useRouter();
  const isFocused = useIsFocused();
  const submit = useSubmitOutput();
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const scrollRef = useRef<ScrollView>(null);

  const [content, setContent] = useState('');
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null);
  const [inputMethod, setInputMethod] = useState<InputMethod>('text');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const navigateToBreak = useCallback(() => {
    router.replace({
      pathname: '/session/[id]/break',
      params: { id: sessionId, break: String(breakMinutes) },
    });
  }, [router, sessionId, breakMinutes]);

  const handleEditorSubmit = useCallback(
    ({ content: nextContent, submitted_at }: OutputEditorSubmitPayload) => {
      setLocalErrorMessage(null);
      submit.reset();
      submit.mutate(
        { sessionId, content: nextContent, submitted_at },
        {
          onSuccess: navigateToBreak,
        },
      );
    },
    [submit, sessionId, navigateToBreak],
  );

  const { start, reset } = useTimer({
    enabled: isFocused,
    onComplete: () => {
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        setLocalErrorMessage('時間になりました。学習内容を入力してから送信してください。');
        return;
      }
      setLocalErrorMessage('時間になりました。内容を確認して送信してください。');
    },
  });

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start('output', outputMinutes * 60);
    return () => {
      reset();
    };
    // 依存を意図的に空にしている: start/reset が参照として安定しているうえ、
    // startedRef で二重 start を防いでいるため再実行は不要。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 120, animated: true });
      });
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const submitErrorMessage =
    localErrorMessage ??
    (submit.isError
      ? isApiError(submit.error)
        ? (submit.error.problem?.detail ?? '送信に失敗しました。時間をおいて再度お試しください。')
        : '送信に失敗しました。時間をおいて再度お試しください。'
      : null);

  // 画像 / 音声 は未実装のため、テキスト以外の方法を選んだ場合はエディターを無効化する。
  const isEditorDisabled = inputMethod !== 'text';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.container, isKeyboardVisible ? styles.containerKeyboardVisible : null]}
            testID="output-root"
          >
            {isKeyboardVisible ? null : (
              <>
                <View style={styles.settingsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="設定"
                    onPress={() => router.push('/(tabs)/settings')}
                    style={({ pressed }) => [
                      styles.settingsButton,
                      pressed ? styles.settingsButtonPressed : null,
                    ]}
                    hitSlop={8}
                    testID="output-settings-button"
                  >
                    <SettingsIcon />
                  </Pressable>
                </View>

                <View style={styles.badgeRow}>
                  <View style={styles.badge} testID="output-hourglass-badge">
                    {Array.from({ length: HOURGLASS_BADGE_COUNT }).map((_, index) => {
                      const isActive = index + 1 === currentLoop;
                      return (
                        <HourglassBadgeIcon
                          key={index}
                          active={isActive}
                          testID={`output-hourglass-badge-icon-${index + 1}`}
                        />
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            <View style={styles.phaseTabs} testID="output-phase-tabs">
              {PHASES.map((p, index) => {
                const isActive = p === CURRENT_PHASE;
                const isLast = index === PHASES.length - 1;
                return (
                  <View key={p} style={styles.phaseTabItemRow}>
                    <View style={styles.phaseTab} testID={`output-phase-tab-${p}`}>
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

            <View
              style={[
                styles.mainContent,
                isKeyboardVisible ? styles.mainContentKeyboardVisible : null,
              ]}
            >
              <View
                style={[
                  styles.timerStage,
                  isKeyboardVisible ? styles.timerStageKeyboardVisible : null,
                ]}
              >
                <CircularTimer
                  phaseLabel={PHASE_LABELS[CURRENT_PHASE]}
                  compact={isKeyboardVisible}
                />
                {isKeyboardVisible ? null : (
                  <SizableText style={styles.timerCaption} testID="output-timer-caption">
                    勉強したことを文字や音声にしてみましょう
                  </SizableText>
                )}
              </View>

              <View style={styles.composerCard} testID="output-composer-card">
                <InputMethodTabs value={inputMethod} onChange={setInputMethod} />

                <View style={styles.editorArea}>
                  <OutputEditor
                    value={content}
                    onChange={(nextValue) => {
                      setContent(nextValue);
                      if (localErrorMessage !== null) {
                        setLocalErrorMessage(null);
                      }
                      if (submit.isError) {
                        submit.reset();
                      }
                    }}
                    onSubmit={handleEditorSubmit}
                    isSubmitting={submit.isPending}
                    errorMessage={submitErrorMessage}
                    disabled={isEditorDisabled}
                    onFocus={() => {
                      requestAnimationFrame(() => {
                        scrollRef.current?.scrollTo({ y: 120, animated: true });
                      });
                    }}
                  />
                  {isEditorDisabled ? (
                    <SizableText style={styles.methodNotice} testID="output-method-notice">
                      {INPUT_METHOD_LABELS[inputMethod]}入力は近日公開予定です。
                    </SizableText>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingTop: 12,
    paddingRight: 24,
    paddingBottom: 32,
    paddingLeft: 24,
  },
  containerKeyboardVisible: {
    paddingBottom: 12,
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
  mainContent: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 20,
  },
  mainContentKeyboardVisible: {
    flex: 0,
    gap: 16,
  },
  timerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  timerStageKeyboardVisible: {
    flex: 0,
    gap: 10,
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
  timerCenterCompact: {
    gap: 2,
  },
  timerPhaseLabel: {
    color: PRIMARY_COLOR,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  timerPhaseLabelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  timerText: {
    color: PRIMARY_COLOR,
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 64,
  },
  timerTextCompact: {
    fontSize: 34,
    lineHeight: 40,
  },
  timerCaption: {
    color: CAPTION_COLOR,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  composerCard: {
    gap: 12,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  methodTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  methodTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  methodTabActive: {
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  methodTabLabel: {
    color: TEXT_INACTIVE,
    fontSize: 13,
    fontWeight: '600',
  },
  methodTabLabelActive: {
    color: PRIMARY_COLOR,
    fontWeight: '700',
  },
  editorArea: {
    gap: 8,
  },
  methodNotice: {
    color: ERROR_COLOR,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});

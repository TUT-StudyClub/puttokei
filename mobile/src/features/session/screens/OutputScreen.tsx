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
import {
  CircularPhaseTimer,
  HourglassBadge,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useTimer } from '@/features/session/hooks/useTimer';
import { useSubmitOutput } from '@/features/session/hooks/useSubmitOutput';
import { isApiError } from '@/shared/lib/api';
import { useLoopStore } from '@/shared/stores/loopStore';

const CURRENT_PHASE: SessionPhase = 'output';

// ピンク基調 (アウトプットフェーズ用)
const PRIMARY_COLOR = '#EC4899';
const PRIMARY_SOFT_COLOR = '#FBE4EF';
const TEXT_INACTIVE = '#9CA3AF';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';

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
  input?: string;
  output?: string;
  break?: string;
};

export function OutputScreen() {
  const params = useLocalSearchParams<SessionRouteParams>();
  const sessionId = params.id ?? '';
  const inputMinutes = Number(params.input) || DEFAULT_TIMER.input_minutes;
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
      params: {
        id: sessionId,
        input: String(inputMinutes),
        output: String(outputMinutes),
        break: String(breakMinutes),
      },
    });
  }, [router, sessionId, inputMinutes, outputMinutes, breakMinutes]);

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
                <SessionSettingsButton
                  onPress={() => router.push('/(tabs)/settings')}
                  testID="output-settings-button"
                />

                <HourglassBadge
                  currentLoop={currentLoop}
                  testIDPrefix="output"
                  activeColor={PRIMARY_COLOR}
                  inactiveColor={TEXT_INACTIVE}
                  borderColor={BORDER_COLOR}
                />
              </>
            )}

            <PhaseTabs
              activePhase={CURRENT_PHASE}
              testIDPrefix="output"
              activeDotColor={PRIMARY_COLOR}
              inactiveDotColor={DOT_INACTIVE}
            />

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
                <CircularPhaseTimer
                  phase={CURRENT_PHASE}
                  primaryColor={PRIMARY_COLOR}
                  trackColor={PRIMARY_SOFT_COLOR}
                  testID="output-circular-timer"
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

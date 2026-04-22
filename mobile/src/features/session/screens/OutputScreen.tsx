/**
 * アウトプットフェーズ画面。
 *
 * InputScreen と骨格を揃えつつ、タイマー下に「テキスト / 画像 / 音声」の入力方法切替と
 * 選択中の入力方法に応じた投稿パネルを配置する。
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
  Image,
  Keyboard,
  KeyboardAvoidingView,
  NativeModules,
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
const ACTION_COLOR = '#4B5CFF';
const INPUT_PHASE_SOFT_COLOR = '#B9DFFF';
const METHOD_ACTIVE_COLOR = '#2F2F2F';
const METHOD_INACTIVE_COLOR = '#777777';
const TEXT_INACTIVE = '#9CA3AF';
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';

// 入力方法。現時点で送信 API はテキストのみ接続済み。
const INPUT_METHODS = ['text', 'image', 'voice'] as const;
type InputMethod = (typeof INPUT_METHODS)[number];

const INPUT_METHOD_LABELS: Record<InputMethod, string> = {
  text: 'テキスト',
  image: '画像',
  voice: '音声',
};

type ExpoNativeModulesGlobal = typeof globalThis & {
  expo?: {
    modules?: Record<string, unknown>;
  };
};

type LegacyExpoNativeProxy = {
  exportedMethods?: Record<string, unknown>;
};

function hasNativeImagePickerModule() {
  const expoModules = (globalThis as ExpoNativeModulesGlobal).expo?.modules;
  const legacyExpoModules = NativeModules.NativeUnimoduleProxy as LegacyExpoNativeProxy | undefined;

  return Boolean(
    expoModules?.ExponentImagePicker || legacyExpoModules?.exportedMethods?.ExponentImagePicker,
  );
}

// 各方法を示すシンプルなラインアイコン。
function InputMethodIcon({
  method,
  color,
  size = 18,
}: {
  method: InputMethod;
  color: string;
  size?: number;
}) {
  switch (method) {
    case 'text':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
  const isImagePanel = value === 'image';

  return (
    <View
      style={[styles.methodTabs, isImagePanel ? styles.methodTabsImagePanel : null]}
      testID="output-method-tabs"
    >
      {INPUT_METHODS.map((method) => {
        const isActive = method === value;
        const color = isActive ? METHOD_ACTIVE_COLOR : METHOD_INACTIVE_COLOR;
        return (
          <Pressable
            key={method}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(method)}
            style={[styles.methodTab, isActive ? styles.methodTabActive : null]}
            testID={`output-method-tab-${method}`}
          >
            <InputMethodIcon method={method} color={color} size={20} />
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

function AddImageIcon({ color = METHOD_ACTIVE_COLOR }: { color?: string }) {
  return (
    <Svg width={42} height={42} viewBox="0 0 48 48" fill="none">
      <Path
        d="M9 12 H32 C34.2 12 36 13.8 36 16 V20"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12 V34 C9 36.2 10.8 38 13 38 H34 C36.2 38 38 36.2 38 34 V27"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={18} cy={21} r={3.5} stroke={color} strokeWidth={3} />
      <Path
        d="M12 35 L22 25 L29 31 L33 27 L38 32"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M39 8 V20" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M33 14 H45" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

type ImageOutputPanelProps = {
  imageUris: string[];
  onAddImage: () => void;
};

function ImageOutputPanel({ imageUris, onAddImage }: ImageOutputPanelProps) {
  return (
    <View style={styles.imageOutputPanel} testID="output-image-panel">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.imageGrid}
      >
        {imageUris.map((uri, index) => (
          <Image
            key={`${uri}-${index}`}
            accessibilityLabel={`撮影済み画像${index + 1}`}
            resizeMode="cover"
            source={{ uri }}
            style={styles.imageThumbnail}
            testID={`output-image-thumbnail-${index}`}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="画像を追加"
          onPress={onAddImage}
          style={({ pressed }) => [styles.imageAddButton, pressed ? styles.buttonPressed : null]}
          testID="output-image-add-button"
        >
          <AddImageIcon />
        </Pressable>
      </ScrollView>
    </View>
  );
}

type ImageSubmissionFooterProps = {
  errorMessage?: string | null;
  onSubmit: () => void;
};

function ImageSubmissionFooter({ errorMessage, onSubmit }: ImageSubmissionFooterProps) {
  return (
    <View style={styles.imageSubmissionFooter}>
      <SizableText style={styles.imageSubmissionNote} testID="output-image-submit-note">
        提出後も時間内であれば編集できます
      </SizableText>
      {errorMessage ? (
        <SizableText style={styles.imageSubmissionError} testID="output-image-submit-error">
          {errorMessage}
        </SizableText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onSubmit}
        style={({ pressed }) => [styles.imageSubmitButton, pressed ? styles.buttonPressed : null]}
        testID="output-image-submit"
      >
        <SizableText style={styles.imageSubmitButtonText}>提出する</SizableText>
      </Pressable>
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
  const {
    error: submitError,
    isError: isSubmitError,
    isPending: isSubmitPending,
    mutate: submitOutputMutate,
    reset: resetSubmit,
  } = useSubmitOutput();
  const currentLoop = useLoopStore((s) => s.currentLoop);
  const scrollRef = useRef<ScrollView>(null);

  const [content, setContent] = useState('');
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null);
  const [inputMethod, setInputMethod] = useState<InputMethod>('text');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const isImageMethod = inputMethod === 'image';
  const isVoiceMethod = inputMethod === 'voice';

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
      resetSubmit();
      submitOutputMutate(
        { sessionId, content: nextContent, submitted_at },
        {
          onSuccess: navigateToBreak,
        },
      );
    },
    [navigateToBreak, resetSubmit, sessionId, submitOutputMutate],
  );

  const handleInputMethodChange = useCallback(
    (method: InputMethod) => {
      setInputMethod(method);
      setLocalErrorMessage(null);
      if (isSubmitError) {
        resetSubmit();
      }
    },
    [isSubmitError, resetSubmit],
  );

  const handleImageSubmit = useCallback(() => {
    setLocalErrorMessage('画像入力の送信は近日公開予定です。');
  }, []);

  const handleAddImage = useCallback(async () => {
    setLocalErrorMessage(null);
    if (isSubmitError) {
      resetSubmit();
    }

    try {
      if (!hasNativeImagePickerModule()) {
        setLocalErrorMessage(
          'カメラ機能を使うにはアプリの再ビルドが必要です。Metro を止めて task ios を実行してください。',
        );
        return;
      }

      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setLocalErrorMessage('カメラの使用が許可されていません。設定から許可してください。');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        mediaTypes: 'images',
        quality: 0.8,
      });

      if (result.canceled) return;

      const uri = result.assets[0]?.uri;
      if (uri) {
        setImageUris((current) => [...current, uri]);
      }
    } catch {
      setLocalErrorMessage('カメラを起動できませんでした。時間をおいて再度お試しください。');
    }
  }, [isSubmitError, resetSubmit]);

  const { start, reset } = useTimer({
    enabled: isFocused,
    onComplete: () => {
      if (isImageMethod) {
        setLocalErrorMessage('時間になりました。画像を確認して提出してください。');
        return;
      }
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        setLocalErrorMessage('時間になりました。学習内容を入力してから送信してください。');
        return;
      }
      setLocalErrorMessage('時間になりました。内容を確認して送信してください。');
    },
  });

  useEffect(() => {
    setContent('');
    setInputMethod('text');
    setImageUris([]);
    setLocalErrorMessage(null);
    resetSubmit();
    start('output', outputMinutes * 60);
    return () => {
      reset();
    };
  }, [outputMinutes, reset, resetSubmit, sessionId, start]);

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
    (isSubmitError
      ? isApiError(submitError)
        ? (submitError.problem?.detail ?? '送信に失敗しました。時間をおいて再度お試しください。')
        : '送信に失敗しました。時間をおいて再度お試しください。'
      : null);

  const showSessionChrome = !isKeyboardVisible && !isImageMethod;

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
            style={[
              styles.container,
              isKeyboardVisible ? styles.containerKeyboardVisible : null,
              isImageMethod ? styles.containerImageMethod : null,
            ]}
            testID="output-root"
          >
            {showSessionChrome ? (
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
            ) : null}

            <PhaseTabs
              activePhase={CURRENT_PHASE}
              testIDPrefix="output"
              activeDotColor={PRIMARY_COLOR}
              inactiveDotColor={DOT_INACTIVE}
              inactiveDotColors={{ input: INPUT_PHASE_SOFT_COLOR }}
              activeTextColor={PRIMARY_COLOR}
              inactiveTextColors={{ input: INPUT_PHASE_SOFT_COLOR }}
              marginBottom={isImageMethod ? 16 : 24}
            />

            <View
              style={[
                styles.mainContent,
                isKeyboardVisible ? styles.mainContentKeyboardVisible : null,
                isImageMethod ? styles.mainContentImageMethod : null,
              ]}
            >
              <View
                style={[
                  styles.timerStage,
                  isKeyboardVisible ? styles.timerStageKeyboardVisible : null,
                  isImageMethod ? styles.timerStageImageMethod : null,
                ]}
              >
                <CircularPhaseTimer
                  phase={CURRENT_PHASE}
                  primaryColor={PRIMARY_COLOR}
                  trackColor={PRIMARY_SOFT_COLOR}
                  testID="output-circular-timer"
                  compact={isKeyboardVisible}
                />
                {isKeyboardVisible || isImageMethod ? null : (
                  <SizableText style={styles.timerCaption} testID="output-timer-caption">
                    勉強したことを文字や音声にしてみましょう
                  </SizableText>
                )}
              </View>

              <View
                style={[styles.composerCard, isImageMethod ? styles.composerCardImageMethod : null]}
                testID="output-composer-card"
              >
                <InputMethodTabs value={inputMethod} onChange={handleInputMethodChange} />

                <View style={styles.editorArea}>
                  {isImageMethod ? (
                    <ImageOutputPanel imageUris={imageUris} onAddImage={handleAddImage} />
                  ) : (
                    <OutputEditor
                      key={sessionId}
                      value={content}
                      onChange={(nextValue) => {
                        setContent(nextValue);
                        if (localErrorMessage !== null) {
                          setLocalErrorMessage(null);
                        }
                        if (isSubmitError) {
                          resetSubmit();
                        }
                      }}
                      onSubmit={handleEditorSubmit}
                      isSubmitting={isSubmitPending}
                      errorMessage={submitErrorMessage}
                      disabled={isVoiceMethod}
                      onFocus={() => {
                        requestAnimationFrame(() => {
                          scrollRef.current?.scrollTo({ y: 120, animated: true });
                        });
                      }}
                    />
                  )}
                  {isVoiceMethod ? (
                    <SizableText style={styles.methodNotice} testID="output-method-notice">
                      {INPUT_METHOD_LABELS[inputMethod]}入力は近日公開予定です。
                    </SizableText>
                  ) : null}
                </View>
              </View>

              {isImageMethod ? (
                <ImageSubmissionFooter
                  errorMessage={submitErrorMessage}
                  onSubmit={handleImageSubmit}
                />
              ) : null}
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
  containerImageMethod: {
    paddingTop: 56,
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
  mainContentImageMethod: {
    justifyContent: 'flex-start',
    gap: 24,
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
  timerStageImageMethod: {
    flex: 0,
    gap: 0,
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
  composerCardImageMethod: {
    minHeight: 344,
    padding: 20,
  },
  methodTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#EDEDED',
  },
  methodTabsImagePanel: {
    marginHorizontal: 20,
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
    color: METHOD_INACTIVE_COLOR,
    fontSize: 13,
    fontWeight: '600',
  },
  methodTabLabelActive: {
    color: METHOD_ACTIVE_COLOR,
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
  imageOutputPanel: {
    minHeight: 244,
  },
  imageGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  imageThumbnail: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  imageAddButton: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#DADADA',
  },
  imageSubmissionFooter: {
    gap: 14,
    paddingHorizontal: 24,
  },
  imageSubmissionNote: {
    color: '#8A8A8A',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  imageSubmissionError: {
    color: ERROR_COLOR,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  imageSubmitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    borderRadius: 20,
    backgroundColor: ACTION_COLOR,
  },
  imageSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  buttonPressed: {
    opacity: 0.72,
  },
});

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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SizableText } from 'tamagui';

import { OutputEditor } from '@/features/session/components/OutputEditor';
import type { OutputEditorSubmitPayload } from '@/features/session/components/OutputEditor';
import {
  ImageOutputPanel,
  ImageSubmissionFooter,
  InputMethodTabs,
  type InputMethod,
  VoiceRecognitionPanel,
} from '@/features/session/components/OutputInputMethods';
import {
  CircularPhaseTimer,
  HourglassBadge,
  PhaseTabs,
  type SessionPhase,
  SessionSettingsButton,
} from '@/features/session/components/SessionPhaseChrome';
import { DEFAULT_TIMER } from '@/features/session/config';
import { useSubmitOutput } from '@/features/session/hooks/useSubmitOutput';
import { useTimer } from '@/features/session/hooks/useTimer';
import { useVoiceRecognition } from '@/features/session/hooks/useVoiceRecognition';
import {
  appendTranscriptToContent,
  buildImageOutputContent,
  hasNativeImagePickerModule,
} from '@/features/session/lib/outputSubmission';
import { isApiError } from '@/shared/lib/api';
import { APP_COLORS } from '@/shared/lib/colors';
import { useLoopStore } from '@/shared/stores/loopStore';

const CURRENT_PHASE: SessionPhase = 'output';

// ピンク基調 (アウトプットフェーズ用)
const PRIMARY_COLOR = APP_COLORS.output;
const PRIMARY_SOFT_COLOR = '#FBE4EF';
const INPUT_PHASE_SOFT_COLOR = '#B9DFFF';
const DOT_INACTIVE = APP_COLORS.dotInactive;
const BORDER_COLOR = APP_COLORS.border;
const CAPTION_COLOR = APP_COLORS.textMuted;

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
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false);

  const isImageMethod = inputMethod === 'image';
  const isVoiceMethod = inputMethod === 'voice';

  const handleFinalVoiceTranscript = useCallback(
    (transcript: string) => {
      setContent((currentContent) => appendTranscriptToContent(currentContent, transcript));
      setLocalErrorMessage(null);
      if (isSubmitError) {
        resetSubmit();
      }
    },
    [isSubmitError, resetSubmit],
  );

  const {
    isRecognizing: isVoiceRecognizing,
    statusMessage: voiceStatusMessage,
    errorMessage: voiceErrorMessage,
    interimTranscript: voiceInterimTranscript,
    startListening,
    stopListening,
    resetVoiceRecognition,
  } = useVoiceRecognition({
    onFinalTranscript: handleFinalVoiceTranscript,
  });

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
      if (method !== 'voice' && isVoiceRecognizing) {
        stopListening();
      }
      setInputMethod(method);
      setLocalErrorMessage(null);
      setIsImageMenuOpen(false);
      if (isSubmitError) {
        resetSubmit();
      }
    },
    [isSubmitError, isVoiceRecognizing, resetSubmit, stopListening],
  );

  const handleImageSubmit = useCallback(() => {
    if (isSubmitPending) return;

    if (imageUris.length === 0) {
      setLocalErrorMessage('画像を1枚以上追加してから提出してください。');
      return;
    }

    setLocalErrorMessage(null);
    resetSubmit();
    submitOutputMutate(
      {
        sessionId,
        content: buildImageOutputContent(imageUris),
        submitted_at: new Date().toISOString(),
      },
      {
        onSuccess: navigateToBreak,
      },
    );
  }, [imageUris, isSubmitPending, navigateToBreak, resetSubmit, sessionId, submitOutputMutate]);

  const handleToggleImageMenu = useCallback(() => {
    setLocalErrorMessage(null);
    if (isSubmitError) {
      resetSubmit();
    }
    setIsImageMenuOpen((current) => !current);
  }, [isSubmitError, resetSubmit]);

  const handlePickFromLibrary = useCallback(async () => {
    setIsImageMenuOpen(false);
    setLocalErrorMessage(null);
    if (isSubmitError) {
      resetSubmit();
    }

    try {
      if (!hasNativeImagePickerModule()) {
        setLocalErrorMessage(
          '画像機能を使うにはアプリの再ビルドが必要です。Metro を止めて task ios を実行してください。',
        );
        return;
      }

      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
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
      setLocalErrorMessage('写真アルバムを開けませんでした。時間をおいて再度お試しください。');
    }
  }, [isSubmitError, resetSubmit]);

  const handleTakePhoto = useCallback(async () => {
    setIsImageMenuOpen(false);
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
      if (isVoiceMethod && isVoiceRecognizing) {
        stopListening();
        setLocalErrorMessage('時間になりました。音声入力を停止して内容を確認してください。');
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
    setIsImageMenuOpen(false);
    resetVoiceRecognition();
    resetSubmit();
    start('output', outputMinutes * 60);
    return () => {
      resetVoiceRecognition();
      reset();
    };
  }, [outputMinutes, reset, resetSubmit, resetVoiceRecognition, sessionId, start]);

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
              inactiveDotFilledPhases={{ input: true }}
              marginBottom={isImageMethod ? 10 : 24}
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
                  compact={isKeyboardVisible || isImageMethod}
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
                    <ImageOutputPanel
                      imageUris={imageUris}
                      isMenuOpen={isImageMenuOpen}
                      onToggleMenu={handleToggleImageMenu}
                      onPickFromLibrary={handlePickFromLibrary}
                      onTakePhoto={handleTakePhoto}
                    />
                  ) : (
                    <>
                      {isVoiceMethod ? (
                        <VoiceRecognitionPanel
                          isRecognizing={isVoiceRecognizing}
                          statusMessage={voiceStatusMessage}
                          errorMessage={voiceErrorMessage}
                          interimTranscript={voiceInterimTranscript}
                          onStart={startListening}
                          onStop={stopListening}
                        />
                      ) : null}
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
                        onFocus={() => {
                          requestAnimationFrame(() => {
                            scrollRef.current?.scrollTo({ y: 120, animated: true });
                          });
                        }}
                      />
                    </>
                  )}
                </View>
              </View>

              {isImageMethod ? (
                <ImageSubmissionFooter
                  errorMessage={submitErrorMessage}
                  isSubmitting={isSubmitPending}
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
    paddingTop: 12,
    paddingRight: 14,
    paddingLeft: 14,
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
    gap: 10,
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
  editorArea: {
    gap: 8,
  },
});

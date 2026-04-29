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
import { useVoiceRecognition } from '@/features/session/hooks/useVoiceRecognition';
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
const DOT_INACTIVE = '#D9D9D9';
const BORDER_COLOR = '#E5E7EB';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';
const MAX_OUTPUT_CONTENT_LENGTH = 2000;

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

function buildImageOutputContent(imageUris: string[]) {
  const header = `画像でアウトプットしました。撮影した学習内容の画像を提出しました。（${imageUris.length}枚）`;
  const lines = imageUris.map((uri, index) => `画像${index + 1}: ${uri}`);
  const content = [header, ...lines].join('\n');

  return content.length > MAX_OUTPUT_CONTENT_LENGTH
    ? content.slice(0, MAX_OUTPUT_CONTENT_LENGTH)
    : content;
}

function appendTranscriptToContent(currentContent: string, transcript: string) {
  const nextTranscript = transcript.trim();
  if (!nextTranscript) return currentContent;

  const trimmedCurrentContent = currentContent.trimEnd();
  if (!trimmedCurrentContent) return nextTranscript;
  if (trimmedCurrentContent.endsWith(nextTranscript)) return currentContent;

  return `${trimmedCurrentContent}\n${nextTranscript}`;
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
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onPickFromLibrary: () => void;
  onTakePhoto: () => void;
};

function ImageOutputPanel({
  imageUris,
  isMenuOpen,
  onToggleMenu,
  onPickFromLibrary,
  onTakePhoto,
}: ImageOutputPanelProps) {
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
        <View style={styles.imageAddColumn}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="画像を追加"
            accessibilityState={{ expanded: isMenuOpen }}
            onPress={onToggleMenu}
            style={({ pressed }) => [
              styles.imageAddButton,
              isMenuOpen ? styles.imageAddButtonActive : null,
              pressed ? styles.buttonPressed : null,
            ]}
            testID="output-image-add-button"
          >
            <AddImageIcon />
          </Pressable>
          {isMenuOpen ? (
            <View style={styles.imageAddMenu} testID="output-image-add-menu">
              <View style={styles.imageAddMenuArrow} />
              <Pressable
                accessibilityRole="menuitem"
                onPress={onPickFromLibrary}
                style={({ pressed }) => [
                  styles.imageAddMenuItem,
                  pressed ? styles.imageAddMenuItemPressed : null,
                ]}
                testID="output-image-add-menu-library"
              >
                <SizableText style={styles.imageAddMenuItemText}>写真アルバムから選択</SizableText>
              </Pressable>
              <View style={styles.imageAddMenuDivider} />
              <Pressable
                accessibilityRole="menuitem"
                onPress={onTakePhoto}
                style={({ pressed }) => [
                  styles.imageAddMenuItem,
                  pressed ? styles.imageAddMenuItemPressed : null,
                ]}
                testID="output-image-add-menu-camera"
              >
                <SizableText style={styles.imageAddMenuItemText}>写真を撮影</SizableText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

type ImageSubmissionFooterProps = {
  errorMessage?: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
};

function ImageSubmissionFooter({
  errorMessage,
  isSubmitting,
  onSubmit,
}: ImageSubmissionFooterProps) {
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
        accessibilityState={{ disabled: isSubmitting }}
        disabled={isSubmitting}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.imageSubmitButton,
          pressed ? styles.buttonPressed : null,
          isSubmitting ? styles.imageSubmitButtonDisabled : null,
        ]}
        testID="output-image-submit"
      >
        <SizableText style={styles.imageSubmitButtonText}>
          {isSubmitting ? '提出中...' : '提出する'}
        </SizableText>
      </Pressable>
    </View>
  );
}

type VoiceRecognitionPanelProps = {
  isRecognizing: boolean;
  statusMessage: string;
  errorMessage?: string | null;
  interimTranscript: string;
  onStart: () => void;
  onStop: () => void;
};

function VoiceRecognitionPanel({
  isRecognizing,
  statusMessage,
  errorMessage,
  interimTranscript,
  onStart,
  onStop,
}: VoiceRecognitionPanelProps) {
  return (
    <View style={styles.voicePanel} testID="output-voice-panel">
      <View style={styles.voicePanelHeader}>
        <View style={[styles.voicePulse, isRecognizing ? styles.voicePulseActive : null]}>
          <InputMethodIcon method="voice" color={isRecognizing ? '#FFFFFF' : PRIMARY_COLOR} />
        </View>
        <SizableText style={styles.voiceStatus} testID="output-voice-status">
          {statusMessage}
        </SizableText>
      </View>

      {interimTranscript ? (
        <View style={styles.voiceInterimBox} testID="output-voice-interim">
          <SizableText style={styles.voiceInterimText}>{interimTranscript}</SizableText>
        </View>
      ) : null}

      {errorMessage ? (
        <SizableText style={styles.voiceError} testID="output-voice-error">
          {errorMessage}
        </SizableText>
      ) : null}

      <View style={styles.voiceActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isRecognizing }}
          disabled={isRecognizing}
          onPress={onStart}
          style={({ pressed }) => [
            styles.voiceActionButton,
            isRecognizing ? styles.voiceActionButtonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
          testID="output-voice-start"
        >
          <SizableText style={styles.voiceActionButtonText}>開始</SizableText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !isRecognizing }}
          disabled={!isRecognizing}
          onPress={onStop}
          style={({ pressed }) => [
            styles.voiceActionButton,
            styles.voiceStopButton,
            !isRecognizing ? styles.voiceActionButtonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
          testID="output-voice-stop"
        >
          <SizableText style={styles.voiceActionButtonText}>停止</SizableText>
        </Pressable>
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
    marginHorizontal: 0,
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
  voicePanel: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PRIMARY_SOFT_COLOR,
    backgroundColor: '#FFF7FB',
  },
  voicePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voicePulse: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY_SOFT_COLOR,
  },
  voicePulseActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  voiceStatus: {
    flex: 1,
    color: METHOD_ACTIVE_COLOR,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  voiceInterimBox: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  voiceInterimText: {
    color: CAPTION_COLOR,
    fontSize: 13,
    lineHeight: 20,
  },
  voiceError: {
    color: ERROR_COLOR,
    fontSize: 12,
    lineHeight: 18,
  },
  voiceActions: {
    flexDirection: 'row',
    gap: 10,
  },
  voiceActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: ACTION_COLOR,
  },
  voiceStopButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  voiceActionButtonDisabled: {
    opacity: 0.45,
  },
  voiceActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
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
    alignItems: 'flex-start',
    gap: 28,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  imageThumbnail: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  imageAddColumn: {
    alignItems: 'stretch',
    gap: 10,
  },
  imageAddButton: {
    width: 76,
    height: 76,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#DADADA',
  },
  imageAddButtonActive: {
    borderColor: '#4B8BF5',
  },
  imageAddMenu: {
    position: 'relative',
    alignSelf: 'stretch',
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#D9D9D9',
  },
  imageAddMenuArrow: {
    position: 'absolute',
    top: -6,
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#D9D9D9',
    transform: [{ rotate: '45deg' }],
  },
  imageAddMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAddMenuItemPressed: {
    opacity: 0.6,
  },
  imageAddMenuItemText: {
    color: '#2F2F2F',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  imageAddMenuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
    backgroundColor: '#9A9A9A',
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
  imageSubmitButtonDisabled: {
    opacity: 0.62,
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

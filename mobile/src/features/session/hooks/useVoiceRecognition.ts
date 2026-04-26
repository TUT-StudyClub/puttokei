import { useCallback, useEffect, useRef, useState } from 'react';

import { requireOptionalNativeModule } from 'expo';

const VOICE_RECOGNITION_LANGUAGE = 'ja-JP';

const VOICE_RECOGNITION_OPTIONS = {
  lang: VOICE_RECOGNITION_LANGUAGE,
  interimResults: true,
  continuous: true,
} as const;

const DEFAULT_STATUS_MESSAGE = 'マイクボタンを押して話してください。';
const MISSING_NATIVE_MODULE_MESSAGE =
  '音声認識機能を使うには development build の再インストールが必要です。Metro を止めて task ios:device または task android:device を実行してください。';

type ExpoSpeechRecognitionErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'busy'
  | 'client'
  | 'speech-timeout'
  | 'unknown';

type SpeechRecognitionResultEvent = {
  isFinal: boolean;
  results: {
    transcript: string;
  }[];
};

type SpeechRecognitionErrorEvent = {
  error: ExpoSpeechRecognitionErrorCode;
  message: string;
};

type SpeechRecognitionEventMap = {
  start: null;
  end: null;
  result: SpeechRecognitionResultEvent;
  nomatch: null;
  error: SpeechRecognitionErrorEvent;
};

type SpeechRecognitionSubscription = {
  remove: () => void;
};

type NativeSpeechRecognitionModule = {
  isRecognitionAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: typeof VOICE_RECOGNITION_OPTIONS) => void;
  stop: () => void;
  abort: () => void;
  addListener: <EventName extends keyof SpeechRecognitionEventMap>(
    eventName: EventName,
    listener: (event: SpeechRecognitionEventMap[EventName]) => void,
  ) => SpeechRecognitionSubscription;
};

type UseVoiceRecognitionOptions = {
  onFinalTranscript: (transcript: string) => void;
};

function isNativeSpeechRecognitionModule(value: unknown): value is NativeSpeechRecognitionModule {
  const module = value as Partial<NativeSpeechRecognitionModule> | null;
  return Boolean(
    module &&
      typeof module.isRecognitionAvailable === 'function' &&
      typeof module.requestPermissionsAsync === 'function' &&
      typeof module.start === 'function' &&
      typeof module.stop === 'function' &&
      typeof module.abort === 'function' &&
      typeof module.addListener === 'function',
  );
}

function loadSpeechRecognitionModule() {
  const module = requireOptionalNativeModule<unknown>('ExpoSpeechRecognition');
  return isNativeSpeechRecognitionModule(module) ? module : null;
}

function getSpeechRecognitionErrorMessage(error: ExpoSpeechRecognitionErrorCode) {
  switch (error) {
    case 'not-allowed':
      return 'マイクまたは音声認識の使用が許可されていません。設定から許可してください。';
    case 'network':
      return '音声認識に必要な通信が失敗しました。通信環境を確認してもう一度お試しください。';
    case 'no-speech':
    case 'speech-timeout':
      return '音声を聞き取れませんでした。マイクに向かってもう一度話してください。';
    case 'busy':
      return '音声認識が別の処理中です。少し待ってからもう一度お試しください。';
    case 'language-not-supported':
    case 'service-not-allowed':
      return 'この端末では日本語の音声認識を利用できません。端末の音声認識設定を確認してください。';
    case 'audio-capture':
      return 'マイクから音声を取得できませんでした。マイクの状態を確認してください。';
    case 'aborted':
      return '音声入力を停止しました。';
    default:
      return '音声認識に失敗しました。時間をおいて再度お試しください。';
  }
}

export function useVoiceRecognition({ onFinalTranscript }: UseVoiceRecognitionOptions) {
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const lastFinalTranscriptRef = useRef('');
  const isRecognizingRef = useRef(false);
  const moduleRef = useRef<NativeSpeechRecognitionModule | null>(null);
  const subscriptionsRef = useRef<SpeechRecognitionSubscription[]>([]);

  const [isRecognizing, setIsRecognizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(DEFAULT_STATUS_MESSAGE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const updateRecognizing = useCallback((nextValue: boolean) => {
    isRecognizingRef.current = nextValue;
    setIsRecognizing(nextValue);
  }, []);

  const clearRecognitionText = useCallback(() => {
    lastFinalTranscriptRef.current = '';
    setInterimTranscript('');
  }, []);

  const handleRecognitionStart = useCallback(() => {
    updateRecognizing(true);
    setErrorMessage(null);
    setStatusMessage('聞き取り中です。話し終わった文から本文へ追加します。');
  }, [updateRecognizing]);

  const handleRecognitionEnd = useCallback(() => {
    updateRecognizing(false);
    setInterimTranscript('');
    setStatusMessage('音声入力を停止しました。内容を確認して送信してください。');
  }, [updateRecognizing]);

  const handleRecognitionResult = useCallback((event: SpeechRecognitionResultEvent) => {
    const transcript = event.results[0]?.transcript.trim();
    if (!transcript) return;

    setErrorMessage(null);

    if (!event.isFinal) {
      setInterimTranscript(transcript);
      setStatusMessage('認識中です。話し終わると本文へ追加します。');
      return;
    }

    setInterimTranscript('');
    setStatusMessage('認識結果を本文へ追加しました。続けて話すこともできます。');

    if (transcript === lastFinalTranscriptRef.current) return;
    lastFinalTranscriptRef.current = transcript;
    onFinalTranscriptRef.current(transcript);
  }, []);

  const handleRecognitionNoMatch = useCallback(() => {
    updateRecognizing(false);
    setInterimTranscript('');
    setErrorMessage('音声を聞き取れませんでした。マイクに向かってもう一度話してください。');
    setStatusMessage(DEFAULT_STATUS_MESSAGE);
  }, [updateRecognizing]);

  const handleRecognitionError = useCallback(
    (event: SpeechRecognitionErrorEvent) => {
      updateRecognizing(false);
      setInterimTranscript('');

      if (event.error === 'aborted') {
        setErrorMessage(null);
        setStatusMessage('音声入力を停止しました。');
        return;
      }

      setErrorMessage(getSpeechRecognitionErrorMessage(event.error));
      setStatusMessage(DEFAULT_STATUS_MESSAGE);
    },
    [updateRecognizing],
  );

  const showMissingNativeModuleError = useCallback(() => {
    updateRecognizing(false);
    setInterimTranscript('');
    setStatusMessage(DEFAULT_STATUS_MESSAGE);
    setErrorMessage(MISSING_NATIVE_MODULE_MESSAGE);
  }, [updateRecognizing]);

  const cleanupRecognitionListeners = useCallback(() => {
    for (const subscription of subscriptionsRef.current) {
      subscription.remove();
    }
    subscriptionsRef.current = [];
  }, []);

  const resolveSpeechRecognitionModule = useCallback(() => {
    const module = moduleRef.current ?? loadSpeechRecognitionModule();
    moduleRef.current = module;
    return module;
  }, []);

  const ensureRecognitionListeners = useCallback(
    (module: NativeSpeechRecognitionModule) => {
      if (subscriptionsRef.current.length > 0) return;

      subscriptionsRef.current = [
        module.addListener('start', handleRecognitionStart),
        module.addListener('end', handleRecognitionEnd),
        module.addListener('result', handleRecognitionResult),
        module.addListener('nomatch', handleRecognitionNoMatch),
        module.addListener('error', handleRecognitionError),
      ];
    },
    [
      handleRecognitionEnd,
      handleRecognitionError,
      handleRecognitionNoMatch,
      handleRecognitionResult,
      handleRecognitionStart,
    ],
  );

  useEffect(() => cleanupRecognitionListeners, [cleanupRecognitionListeners]);

  const startListening = useCallback(async () => {
    setErrorMessage(null);
    clearRecognitionText();
    setStatusMessage('音声認識の準備をしています。');

    try {
      const module = resolveSpeechRecognitionModule();
      if (module === null) {
        showMissingNativeModuleError();
        return;
      }

      ensureRecognitionListeners(module);

      if (!module.isRecognitionAvailable()) {
        setStatusMessage(DEFAULT_STATUS_MESSAGE);
        setErrorMessage(
          'この端末では音声認識を利用できません。端末の音声認識設定を確認してください。',
        );
        return;
      }

      const permission = await module.requestPermissionsAsync();
      if (!permission.granted) {
        setStatusMessage(DEFAULT_STATUS_MESSAGE);
        setErrorMessage(getSpeechRecognitionErrorMessage('not-allowed'));
        return;
      }

      setStatusMessage('音声入力を開始しています。');
      module.start(VOICE_RECOGNITION_OPTIONS);
    } catch {
      showMissingNativeModuleError();
    }
  }, [
    clearRecognitionText,
    ensureRecognitionListeners,
    resolveSpeechRecognitionModule,
    showMissingNativeModuleError,
  ]);

  const stopListening = useCallback(() => {
    try {
      const module = resolveSpeechRecognitionModule();
      if (module === null) {
        showMissingNativeModuleError();
        return;
      }

      module.stop();
      setStatusMessage('音声入力を停止しています。');
    } catch {
      updateRecognizing(false);
      setStatusMessage(DEFAULT_STATUS_MESSAGE);
      setErrorMessage('音声入力を停止できませんでした。時間をおいて再度お試しください。');
    }
  }, [resolveSpeechRecognitionModule, showMissingNativeModuleError, updateRecognizing]);

  const resetVoiceRecognition = useCallback(() => {
    if (isRecognizingRef.current) {
      try {
        const module = resolveSpeechRecognitionModule();
        module?.abort();
      } catch {
        // 画面切り替え時の後始末なので、失敗しても UI 状態のリセットを優先する。
      }
    }
    updateRecognizing(false);
    clearRecognitionText();
    setErrorMessage(null);
    setStatusMessage(DEFAULT_STATUS_MESSAGE);
  }, [clearRecognitionText, resolveSpeechRecognitionModule, updateRecognizing]);

  return {
    isRecognizing,
    statusMessage,
    errorMessage,
    interimTranscript,
    startListening,
    stopListening,
    resetVoiceRecognition,
  };
}

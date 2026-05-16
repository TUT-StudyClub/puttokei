/**
 * 音声入力フック。
 *
 * 内部は expo-av で音声を録音し、停止時に backend の Cloud Speech-to-Text
 * 経由 endpoint (`POST /sessions/{id}/audio/transcribe`) に multipart で送って
 * 文字起こし結果を受け取る。
 *
 * OutputScreen への API 互換性は維持しているため、画面側のコードは
 * 変更不要。`interimTranscript` は Cloud STT がストリーミング結果を返さない
 * ため常に空文字となる。
 */
import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { transcribeAudio } from '@/features/session/api/audioApi';
import { isApiError } from '@/shared/lib/api';

type RouteParams = {
  id?: string;
};

const DEFAULT_STATUS_MESSAGE = 'マイクボタンを押して話してください。';
const RECORDING_STATUS_MESSAGE = '録音中... 停止ボタンで送信します。';
const PROCESSING_STATUS_MESSAGE = '文字起こし中...';

const PERMISSION_DENIED_MESSAGE =
  'マイクへのアクセスが許可されていません。設定アプリから Hourglass を開き、マイクの利用を許可してください。';
const NETWORK_ERROR_MESSAGE =
  '通信エラーで文字起こしに失敗しました。電波状況を確認して再度お試しください。';
const RATE_LIMIT_MESSAGE = '利用上限に達しました。しばらく時間を置いてから再度お試しください。';
const TIMEOUT_MESSAGE = '文字起こしがタイムアウトしました。短く区切って再度お試しください。';
const UNSUPPORTED_FORMAT_MESSAGE = '対応していない音声形式です。';
const TOO_LARGE_MESSAGE = '音声が長すぎます。短く区切って再度お試しください。';
const GENERIC_ERROR_MESSAGE = '文字起こしに失敗しました。少し時間を置いて再度お試しください。';

const RECORDING_OPTIONS = Audio.RecordingOptionsPresets.HIGH_QUALITY;

type UseVoiceRecognitionInput = {
  onFinalTranscript: (transcript: string) => void;
};

type UseVoiceRecognitionResult = {
  isRecognizing: boolean;
  statusMessage: string;
  errorMessage: string | null;
  interimTranscript: string;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  resetVoiceRecognition: () => void;
};

export function useVoiceRecognition({
  onFinalTranscript,
}: UseVoiceRecognitionInput): UseVoiceRecognitionResult {
  const params = useLocalSearchParams<RouteParams>();
  const sessionId = params.id ?? '';

  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanup = useCallback(async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording === null) return;
    try {
      const status = await recording.getStatusAsync();
      if (status.canRecord || status.isRecording) {
        await recording.stopAndUnloadAsync();
      }
    } catch {
      // 停止失敗はクリーンアップ目的なので握りつぶす
    }
  }, []);

  useEffect(
    () => () => {
      void cleanup();
    },
    [cleanup],
  );

  const startListening = useCallback(async () => {
    if (isRecognizing || isProcessing) return;
    setErrorMessage(null);

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage(PERMISSION_DENIED_MESSAGE);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecognizing(true);
    } catch (error) {
      recordingRef.current = null;
      setErrorMessage(toErrorMessage(error));
      setIsRecognizing(false);
    }
  }, [isProcessing, isRecognizing]);

  const stopListening = useCallback(async () => {
    if (!isRecognizing) return;
    const recording = recordingRef.current;
    recordingRef.current = null;
    setIsRecognizing(false);

    if (recording === null) return;

    setIsProcessing(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri === null) {
        setErrorMessage(GENERIC_ERROR_MESSAGE);
        return;
      }
      // expo-av の HIGH_QUALITY iOS preset は m4a (AAC)、Android は m4a (AAC) で揃う
      const mimeType = 'audio/m4a';
      const { transcript } = await transcribeAudio(sessionId, uri, mimeType);
      const trimmed = transcript.trim();
      if (trimmed === '') {
        setErrorMessage('音声から文字を認識できませんでした。');
        return;
      }
      onFinalTranscript(trimmed);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  }, [isRecognizing, onFinalTranscript, sessionId]);

  const resetVoiceRecognition = useCallback(() => {
    setErrorMessage(null);
    setIsRecognizing(false);
    setIsProcessing(false);
    void cleanup();
  }, [cleanup]);

  const statusMessage = isProcessing
    ? PROCESSING_STATUS_MESSAGE
    : isRecognizing
      ? RECORDING_STATUS_MESSAGE
      : DEFAULT_STATUS_MESSAGE;

  return {
    isRecognizing: isRecognizing || isProcessing,
    statusMessage,
    errorMessage,
    interimTranscript: '',
    startListening,
    stopListening,
    resetVoiceRecognition,
  };
}

function toErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    const type = error.problem?.type ?? '';
    if (type.endsWith('unsupported_audio_format')) return UNSUPPORTED_FORMAT_MESSAGE;
    if (type.endsWith('audio_too_large')) return TOO_LARGE_MESSAGE;
    if (type.endsWith('transcribe_timeout')) return TIMEOUT_MESSAGE;
    if (error.status === 429) return RATE_LIMIT_MESSAGE;
    if (error.status === 401 || error.status === 403) return GENERIC_ERROR_MESSAGE;
    if (error.status >= 500) return NETWORK_ERROR_MESSAGE;
  }
  if (error instanceof Error) {
    return error.message || GENERIC_ERROR_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

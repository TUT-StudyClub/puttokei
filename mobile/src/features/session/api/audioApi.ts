/**
 * 音声 → テキスト変換 API。
 *
 * mobile で録音した音声ファイルを multipart で backend に POST し、
 * Cloud Speech-to-Text 経由で文字起こしされたテキストを受け取る。
 */
import { api } from '@/shared/lib/api';

export type TranscribeAudioResponse = {
  transcript: string;
};

/** Cloud STT による文字起こしリクエスト。 */
export async function transcribeAudio(
  sessionId: string,
  audioUri: string,
  mimeType: string,
): Promise<TranscribeAudioResponse> {
  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: deriveAudioFilename(mimeType),
    type: mimeType,
    // React Native の FormData は any 互換が必要
  } as unknown as Blob);

  const { data } = await api.postMultipart<TranscribeAudioResponse>(
    `/sessions/${sessionId}/audio/transcribe`,
    form,
  );
  return data;
}

function deriveAudioFilename(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('m4a') || lower.includes('mp4')) return 'audio.m4a';
  if (lower.includes('wav')) return 'audio.wav';
  if (lower.includes('mpeg')) return 'audio.mp3';
  return 'audio.bin';
}

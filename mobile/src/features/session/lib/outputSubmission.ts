import { NativeModules } from 'react-native';

const MAX_OUTPUT_CONTENT_LENGTH = 2000;

type ExpoNativeModulesGlobal = typeof globalThis & {
  expo?: {
    modules?: Record<string, unknown>;
  };
};

type LegacyExpoNativeProxy = {
  exportedMethods?: Record<string, unknown>;
};

export function hasNativeImagePickerModule() {
  const expoModules = (globalThis as ExpoNativeModulesGlobal).expo?.modules;
  const legacyExpoModules = NativeModules.NativeUnimoduleProxy as LegacyExpoNativeProxy | undefined;

  return Boolean(
    expoModules?.ExponentImagePicker || legacyExpoModules?.exportedMethods?.ExponentImagePicker,
  );
}

export function buildImageOutputContent(imageUris: string[]) {
  const header = `画像でアウトプットしました。撮影した学習内容の画像を提出しました。（${imageUris.length}枚）`;
  const lines = imageUris.map((uri, index) => `画像${index + 1}: ${uri}`);
  const content = [header, ...lines].join('\n');

  return content.length > MAX_OUTPUT_CONTENT_LENGTH
    ? content.slice(0, MAX_OUTPUT_CONTENT_LENGTH)
    : content;
}

export function appendTranscriptToContent(currentContent: string, transcript: string) {
  const nextTranscript = transcript.trim();
  if (!nextTranscript) return currentContent;

  const trimmedCurrentContent = currentContent.trimEnd();
  if (!trimmedCurrentContent) return nextTranscript;
  if (trimmedCurrentContent.endsWith(nextTranscript)) return currentContent;

  return `${trimmedCurrentContent}\n${nextTranscript}`;
}

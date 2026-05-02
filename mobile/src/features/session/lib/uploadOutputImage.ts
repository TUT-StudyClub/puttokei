/**
 * 画像アウトプットを GCS に直接アップロードするヘルパ。
 *
 * 1. expo-image-manipulator で長辺 1600px に縮小し JPEG で再エンコードする。
 *    元画像の長辺が既に 1600px 以下ならアップスケールせず、再エンコードのみ行う。
 * 2. backend `/sessions/{id}/outputs/image/upload-url` で signed PUT URL を取得する。
 * 3. 取得した URL に画像 blob を PUT する。
 * 4. `storage_path` を返す。呼び出し側はこれを `submitImageOutput` に渡す。
 */
import * as ImageManipulator from 'expo-image-manipulator';

import { issueOutputImageUploadUrl } from '@/features/session/api/sessionApi';

const MAX_LONG_EDGE_PX = 1600;
const JPEG_QUALITY = 0.85;
const UPLOAD_MIME_TYPE = 'image/jpeg' as const;

export type UploadOutputImageResult = {
  storagePath: string;
};

/**
 * picker から得た localUri を圧縮し、GCS に直接アップロードして storage path を返す。
 */
export async function uploadOutputImage(
  sessionId: string,
  localUri: string,
): Promise<UploadOutputImageResult> {
  const manipulated = await prepareUploadAsset(localUri);

  const { upload_url, storage_path } = await issueOutputImageUploadUrl(sessionId, UPLOAD_MIME_TYPE);

  const blob = await fetchAsBlob(manipulated.uri);

  const response = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': UPLOAD_MIME_TYPE,
    },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`failed to upload image to GCS (status=${response.status})`);
  }

  return { storagePath: storage_path };
}

/**
 * 画像を JPEG に再エンコードしつつ、長辺が `MAX_LONG_EDGE_PX` を超える場合のみ
 * 縦横どちらか長い側を `MAX_LONG_EDGE_PX` にリサイズする。アップスケールしない。
 *
 * まず compress=1 で probe してオリジナル寸法を取得し、必要があれば resize 付きで
 * 再エンコードする。expo-image-manipulator の戻り値に画像寸法が含まれるため、
 * `Image.getSize` を使わない（テスト環境の fake timers との相性問題を避ける）。
 */
async function prepareUploadAsset(localUri: string): Promise<ImageManipulator.ImageResult> {
  const probe = await ImageManipulator.manipulateAsync(localUri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const longEdge = Math.max(probe.width, probe.height);
  if (longEdge <= MAX_LONG_EDGE_PX) {
    if (probe.width === 0 || probe.height === 0) {
      // 寸法が取れない (テスト等) ケースはそのまま probe を返す。
      return probe;
    }
    return ImageManipulator.manipulateAsync(localUri, [], {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
  }

  const resize: { width: number } | { height: number } =
    probe.width >= probe.height ? { width: MAX_LONG_EDGE_PX } : { height: MAX_LONG_EDGE_PX };

  return ImageManipulator.manipulateAsync(localUri, [{ resize }], {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
}

async function fetchAsBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`failed to read local image (status=${response.status}, uri=${uri})`);
  }
  return response.blob();
}

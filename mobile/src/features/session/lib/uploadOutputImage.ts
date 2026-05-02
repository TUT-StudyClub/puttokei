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
 * 1 回目の manipulateAsync を JPEG_QUALITY で実行し、長辺が閾値以下なら
 * その結果をそのまま使う（1-pass）。閾値超過時のみ resize 付きで 2 回目を
 * 走らせる（2-pass）。これにより通常サイズの画像での無駄な往復を省く。
 *
 * `Image.getSize` を使わず manipulateAsync の戻り値から寸法を取るのは、
 * テスト環境の fake timers と相性が悪いため。
 */
async function prepareUploadAsset(localUri: string): Promise<ImageManipulator.ImageResult> {
  const reencoded = await ImageManipulator.manipulateAsync(localUri, [], {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  if (reencoded.width === 0 || reencoded.height === 0) {
    // 寸法が取れない (テスト等) ケースはそのまま返す。
    return reencoded;
  }

  const longEdge = Math.max(reencoded.width, reencoded.height);
  if (longEdge <= MAX_LONG_EDGE_PX) {
    return reencoded;
  }

  const resize: { width: number } | { height: number } =
    reencoded.width >= reencoded.height
      ? { width: MAX_LONG_EDGE_PX }
      : { height: MAX_LONG_EDGE_PX };

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

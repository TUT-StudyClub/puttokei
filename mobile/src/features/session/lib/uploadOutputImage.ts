/**
 * 画像アウトプットを GCS に直接アップロードするヘルパ。
 *
 * 1. expo-image-manipulator で長辺 1600px に縮小し JPEG で再エンコードする。
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
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: MAX_LONG_EDGE_PX } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  const { upload_url, storage_path } = await issueOutputImageUploadUrl(
    sessionId,
    UPLOAD_MIME_TYPE,
  );

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

async function fetchAsBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

/**
 * Firebase Web SDK の初期化。
 * 実際の initializeApp は Epic #2（認証）で行う。
 * ここでは差し込みポイントだけ用意しておく。
 */
export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

export function getFirebaseConfig(): FirebaseConfig | null {
  // Epic #2 で expo-constants から読み込む実装にする
  return null;
}

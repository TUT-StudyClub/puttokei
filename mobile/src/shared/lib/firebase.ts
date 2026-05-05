/**
 * Firebase Auth との橋渡し。
 *
 * Firebase JS SDK の初期化本体は Epic #2 で導入する。
 * 本モジュールは ID Token の監視と強制更新の差し込み口だけを公開し、
 * api.ts と RootLayout がこの口経由で Firebase に依存せずに動くようにする。
 *
 * - `subscribeIdTokenChanged(listener)`: Firebase の `onIdTokenChanged` 相当。
 *   サインイン / サインアウト / トークン更新のたびに通知を受ける。
 * - `refreshIdToken()`: Firebase の `getIdToken(true)` 相当。
 *   api クライアントが 401 を受けた際の再取得に使う。
 * - `ensureAnonymousSession()`: 未サインイン時に Firebase Anonymous Auth の UID を作る。
 * - `registerAuthImpl(impl)`: Epic #2 で Firebase SDK を初期化した際に
 *   実装を差し込む。差し込みが無い間は subscribe は何もせず、refresh は null を返す。
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

export type AuthSession = {
  uid: string;
  idToken: string;
  isAnonymous: boolean;
};

export type AuthSessionListener = (session: AuthSession | null) => void;
export type Unsubscribe = () => void;

export type AuthImpl = {
  subscribeIdTokenChanged: (listener: AuthSessionListener) => Unsubscribe;
  refreshIdToken: () => Promise<string | null>;
  ensureAnonymousSession: () => Promise<void>;
};

const NOOP_IMPL: AuthImpl = {
  subscribeIdTokenChanged: () => () => {},
  refreshIdToken: async () => null,
  ensureAnonymousSession: async () => {},
};

let currentImpl: AuthImpl = NOOP_IMPL;

/**
 * Firebase SDK 側から subscribe / refresh の実装を差し込む。
 * Epic #2 の Firebase 初期化コードから一度だけ呼ぶ想定。テストでも mock を差し込める。
 */
export function registerAuthImpl(impl: AuthImpl): void {
  currentImpl = impl;
}

/** 差し込み実装を初期状態に戻す。テストのクリーンアップで使う。 */
export function resetAuthImpl(): void {
  currentImpl = NOOP_IMPL;
}

export function subscribeIdTokenChanged(listener: AuthSessionListener): Unsubscribe {
  return currentImpl.subscribeIdTokenChanged(listener);
}

export async function refreshIdToken(): Promise<string | null> {
  return currentImpl.refreshIdToken();
}

export async function ensureAnonymousSession(): Promise<void> {
  await currentImpl.ensureAnonymousSession();
}

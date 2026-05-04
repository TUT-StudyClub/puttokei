/**
 * DEV 専用: Firebase Auth の代わりに dev-mock トークンを差し込む暫定実装。
 *
 * 固定 UID (`dev-local-user`) を使って `dev-mock-<uid>` を Authorization に乗せる。
 * バックエンドは `DEV_MOCK_AUTH_ENABLED=true` のとき、このトークンを Firebase 検証
 * なしで UID として受け取る (infrastructure/auth/firebase_auth.py)。
 *
 * 固定 UID を採用している理由:
 * - AsyncStorage を使うとネイティブ再ビルドが必要になる
 * - ローカル開発では同一ユーザーで継続できた方が検証しやすい
 *
 * Firebase Anonymous Auth (Epic #2) 実装後は本モジュールを撤去し、
 * Firebase 実装の `registerAuthImpl` に差し替える。
 */
import {
  registerAuthImpl,
  type AuthImpl,
  type AuthSession,
  type AuthSessionListener,
} from '@/shared/lib/firebase';

/** ローカル開発で使う固定 UID。切り替えたい場合はここを書き換える。 */
export const DEV_MOCK_UID = 'dev-local-user';

let currentSession: AuthSession | null = null;
const listeners = new Set<AuthSessionListener>();

function notify(session: AuthSession | null): void {
  currentSession = session;
  for (const listener of listeners) {
    listener(session);
  }
}

/** テストで状態を初期化するためのヘルパ。通常コードからは呼ばない。 */
export function _resetDevMockAuthForTest(): void {
  currentSession = null;
  listeners.clear();
}

/**
 * dev-mock 認証を `registerAuthImpl` 経由で差し込み、固定 UID でセッションを通知する。
 */
export function installDevMockAuth(): void {
  const impl: AuthImpl = {
    subscribeIdTokenChanged: (listener) => {
      listeners.add(listener);
      if (currentSession !== null) {
        listener(currentSession);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    refreshIdToken: async () => {
      return currentSession?.idToken ?? null;
    },
    ensureAnonymousSession: async () => {
      // dev-mock は固定 UID を返すだけで匿名サインインは行わない
    },
  };
  registerAuthImpl(impl);

  notify({ uid: DEV_MOCK_UID, idToken: `dev-mock-${DEV_MOCK_UID}`, isAnonymous: false });
}

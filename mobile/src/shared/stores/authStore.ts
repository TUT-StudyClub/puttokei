/**
 * Zustand の認証ストア。
 *
 * 実際の Firebase サインイン処理は #32（Apple / Google サインイン UI）で実装する。
 * 本 store は uid / idToken を保持するだけで、値の差し込みは
 *  - 本番: Firebase の onIdTokenChanged イベント
 *  - 開発: `setDevMockSession()` による mock トークン
 * のいずれかから行う。
 */
import { create } from 'zustand';

export type AuthState = {
  uid: string | null;
  idToken: string | null;
  setSession: (uid: string, idToken: string) => void;
  clear: () => void;
  /**
   * 開発ビルド専用の mock サインイン。`__DEV__` が true のときだけセッションを設定する。
   * backend 側は `dev-mock-<uid>` 形式のトークンを `dev_mock_auth_enabled=True` 設定下で受理する。
   */
  setDevMockSession: (uid: string) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  idToken: null,
  setSession: (uid, idToken) => set({ uid, idToken }),
  clear: () => set({ uid: null, idToken: null }),
  setDevMockSession: (uid) => {
    if (!__DEV__) return;
    set({ uid, idToken: `dev-mock-${uid}` });
  },
}));

/** interceptor 側で使う、最新の idToken を同期取得するためのヘルパ。 */
export function getAuthIdToken(): string | null {
  return useAuthStore.getState().idToken;
}

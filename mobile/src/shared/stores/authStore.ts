/**
 * Zustand の認証ストア。
 *
 * 実際の Firebase サインイン処理は #32（Apple / Google サインイン UI）で実装する。
 * 本 store は uid / idToken / 匿名状態を保持し、値の差し込みは
 * Firebase の onIdTokenChanged イベントから行う。
 */
import { create } from 'zustand';

export type AuthState = {
  uid: string | null;
  idToken: string | null;
  isAnonymous: boolean;
  setSession: (uid: string, idToken: string, isAnonymous?: boolean) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  idToken: null,
  isAnonymous: false,
  setSession: (uid, idToken, isAnonymous = false) => set({ uid, idToken, isAnonymous }),
  clear: () => set({ uid: null, idToken: null, isAnonymous: false }),
}));

/** interceptor 側で使う、最新の idToken を同期取得するためのヘルパ。 */
export function getAuthIdToken(): string | null {
  return useAuthStore.getState().idToken;
}

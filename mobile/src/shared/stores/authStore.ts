/**
 * Zustand の認証ストア。Epic #2 で Firebase の認証状態と同期する。
 */
import { create } from 'zustand';

export type AuthState = {
  uid: string | null;
  idToken: string | null;
  setSession: (uid: string, idToken: string) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  idToken: null,
  setSession: (uid, idToken) => set({ uid, idToken }),
  clear: () => set({ uid: null, idToken: null }),
}));

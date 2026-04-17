import { useCallback, useState } from 'react';

import { signInWithApple } from '../lib/signInWithApple';
import { signInWithGoogle } from '../lib/signInWithGoogle';
import { verifyAuth } from '../api/authApi';
import { useAuthStore } from '@/shared/stores/authStore';

type SignInState = {
  loading: boolean;
  error: string | null;
};

/** authStore に idToken がセットされるまで待つ。onIdTokenChanged の発火を待機する。 */
function waitForIdToken(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentToken = useAuthStore.getState().idToken;
    if (currentToken !== null) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('ID Token の取得がタイムアウトしました'));
    }, timeoutMs);

    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.idToken !== null) {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}

export function useSignIn() {
  const [state, setState] = useState<SignInState>({ loading: false, error: null });

  const handleSignIn = useCallback(async (provider: () => Promise<void>) => {
    setState({ loading: true, error: null });
    try {
      await provider();
      // Firebase signInWithCredential 完了後、onIdTokenChanged が
      // authStore を更新するのを待ってから verify を呼ぶ
      await waitForIdToken();
      await verifyAuth().catch(() => {
        // verify が失敗しても認証自体は成功しているので握りつぶす。
        // backend の auth middleware が初回リクエスト時に自動作成する。
      });
      setState({ loading: false, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : '認証に失敗しました';
      setState({ loading: false, error: message });
    }
  }, []);

  const handleApple = useCallback(() => handleSignIn(signInWithApple), [handleSignIn]);
  const handleGoogle = useCallback(() => handleSignIn(signInWithGoogle), [handleSignIn]);

  return {
    ...state,
    signInWithApple: handleApple,
    signInWithGoogle: handleGoogle,
    clearError: useCallback(() => setState((s) => ({ ...s, error: null })), []),
  };
}

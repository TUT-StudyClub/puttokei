import { useCallback, useState } from 'react';

import { signInWithApple } from '../lib/signInWithApple';
import { signInWithGoogle } from '../lib/signInWithGoogle';
import { verifyAuth } from '../api/authApi';

type SignInState = {
  loading: boolean;
  error: string | null;
};

export function useSignIn() {
  const [state, setState] = useState<SignInState>({ loading: false, error: null });

  const handleSignIn = useCallback(async (provider: () => Promise<void>) => {
    setState({ loading: true, error: null });
    try {
      await provider();
      // Firebase onIdTokenChanged が authStore を更新するため、
      // ここでは verify を呼んで backend 側にユーザーを登録するだけ
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

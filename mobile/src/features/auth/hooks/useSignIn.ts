import { useCallback, useState } from 'react';

import { signInWithApple } from '../lib/signInWithApple';
import { signInWithGoogle } from '../lib/signInWithGoogle';
import { isAuthFlowCancelledError } from '../lib/authErrors';

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
      // provider 完了後は Firebase の onIdTokenChanged が authStore を更新し、
      // AuthGate が uid の変化を検知して遷移する。ここでは loading を落とすのみ。
      setState({ loading: false, error: null });
    } catch (e) {
      if (isAuthFlowCancelledError(e)) {
        setState({ loading: false, error: null });
        return;
      }

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

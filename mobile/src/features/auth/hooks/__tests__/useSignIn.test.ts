/**
 * useSignIn の振る舞いを検証する。
 * 成功時に loading が落ちること、失敗 / キャンセル時の state 制御を担保する。
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { useSignIn } from '@/features/auth/hooks/useSignIn';
import { AuthFlowCancelledError } from '@/features/auth/lib/authErrors';
import { useAuthStore } from '@/shared/stores/authStore';

// ネイティブモジュールを丸ごと mock
jest.mock('@react-native-firebase/auth', () => () => ({}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  getRandomBytes: jest.fn(() => new Uint8Array(32)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
}));

jest.mock('@/features/auth/lib/signInWithApple');
jest.mock('@/features/auth/lib/signInWithGoogle');

// mock を import の後に取得
const appleAuth = require('@/features/auth/lib/signInWithApple');
const googleAuth = require('@/features/auth/lib/signInWithGoogle');

describe('useSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ uid: null, idToken: null });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ uid: null, idToken: null });
  });

  it('Google サインイン成功時に loading が落ちる', async () => {
    googleAuth.signInWithGoogle.mockImplementation(async () => {
      useAuthStore.setState({ uid: 'google-user', idToken: 'google-token' });
    });

    const { result } = renderHook(() => useSignIn());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(googleAuth.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('Apple サインイン成功時に loading が落ちる', async () => {
    appleAuth.signInWithApple.mockImplementation(async () => {
      useAuthStore.setState({ uid: 'apple-user', idToken: 'apple-token' });
    });

    const { result } = renderHook(() => useSignIn());

    await act(async () => {
      await result.current.signInWithApple();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(appleAuth.signInWithApple).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('サインイン失敗時にエラーメッセージが設定される', async () => {
    googleAuth.signInWithGoogle.mockRejectedValue(
      new Error('Google Sign In: idToken が取得できませんでした'),
    );

    const { result } = renderHook(() => useSignIn());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Google Sign In: idToken が取得できませんでした');
  });

  it('ユーザーキャンセル時はエラーを表示しない', async () => {
    googleAuth.signInWithGoogle.mockRejectedValue(new AuthFlowCancelledError());

    const { result } = renderHook(() => useSignIn());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  it('clearError でエラーがクリアされる', async () => {
    googleAuth.signInWithGoogle.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useSignIn());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('fail');
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});

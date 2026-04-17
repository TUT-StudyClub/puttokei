/**
 * useSignIn の振る舞いを検証する。
 * サインイン成功時に verifyAuth が呼ばれること、
 * 失敗時にエラーメッセージが設定されることを担保する。
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import { useSignIn } from '@/features/auth/hooks/useSignIn';
import * as authApi from '@/features/auth/api/authApi';
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

jest.mock('@/features/auth/api/authApi');
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

  it('Google サインイン成功時に verifyAuth が呼ばれる', async () => {
    googleAuth.signInWithGoogle.mockImplementation(async () => {
      useAuthStore.setState({ uid: 'google-user', idToken: 'google-token' });
    });
    (authApi.verifyAuth as jest.Mock).mockResolvedValue({
      user: { id: '1', firebase_uid: 'google-user', auth_provider: 'google' },
      is_new: true,
    });

    const { result } = renderHook(() => useSignIn());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(googleAuth.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(authApi.verifyAuth).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('Apple サインイン成功時に verifyAuth が呼ばれる', async () => {
    appleAuth.signInWithApple.mockImplementation(async () => {
      useAuthStore.setState({ uid: 'apple-user', idToken: 'apple-token' });
    });
    (authApi.verifyAuth as jest.Mock).mockResolvedValue({
      user: { id: '2', firebase_uid: 'apple-user', auth_provider: 'apple' },
      is_new: false,
    });

    const { result } = renderHook(() => useSignIn());

    await act(async () => {
      await result.current.signInWithApple();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(appleAuth.signInWithApple).toHaveBeenCalledTimes(1);
    expect(authApi.verifyAuth).toHaveBeenCalledTimes(1);
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

  it('verifyAuth が失敗しても認証エラーにならない', async () => {
    googleAuth.signInWithGoogle.mockImplementation(async () => {
      useAuthStore.setState({ uid: 'user', idToken: 'token' });
    });
    (authApi.verifyAuth as jest.Mock).mockRejectedValue(new Error('server error'));

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

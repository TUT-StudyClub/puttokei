/**
 * signInWithApple のキャンセル判定を検証する。
 * ネイティブモジュールが throw する `code === 'ERR_REQUEST_CANCELED'` が
 * `AuthFlowCancelledError` に変換されることを担保する。
 */
import { AuthFlowCancelledError } from '@/features/auth/lib/authErrors';

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('hashed-nonce'),
  getRandomBytes: jest.fn(() => new Uint8Array(32)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
  },
}));

jest.mock('@react-native-firebase/auth', () => {
  const signInWithCredential = jest.fn().mockResolvedValue({});
  const authFn = () => ({ signInWithCredential });
  authFn.AppleAuthProvider = {
    credential: jest.fn().mockReturnValue({}),
  };
  return { __esModule: true, default: authFn };
});

const AppleAuthentication = require('expo-apple-authentication');
const { signInWithApple } = require('@/features/auth/lib/signInWithApple');

describe('signInWithApple', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ネイティブの ERR_REQUEST_CANCELED を AuthFlowCancelledError に変換する', async () => {
    const nativeError = Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' });
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValueOnce(nativeError);

    await expect(signInWithApple()).rejects.toBeInstanceOf(AuthFlowCancelledError);
  });

  it('identityToken が無い場合はエラーを throw する', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({ identityToken: null });

    await expect(signInWithApple()).rejects.toThrow(
      'Apple Sign In: identityToken が取得できませんでした',
    );
  });

  it('その他のエラーはそのまま再 throw する', async () => {
    const otherError = new Error('network down');
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValueOnce(otherError);

    await expect(signInWithApple()).rejects.toThrow('network down');
  });
});

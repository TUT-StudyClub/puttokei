import { linkOrSignInWithCredential } from '@/features/auth/lib/linkOrSignInWithCredential';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

let mockCurrentUser: { isAnonymous: boolean; linkWithCredential: jest.Mock } | null = null;
const mockSignInWithCredential = jest.fn();

jest.mock('@react-native-firebase/auth', () => {
  const authFn = () => ({
    currentUser: mockCurrentUser,
    signInWithCredential: mockSignInWithCredential,
  });
  return { __esModule: true, default: authFn };
});

describe('linkOrSignInWithCredential', () => {
  beforeEach(() => {
    mockCurrentUser = null;
    mockSignInWithCredential.mockReset();
  });

  it('匿名ユーザーがいる場合は credential を link して UID を維持する', async () => {
    const credential = { providerId: 'google.com' } as FirebaseAuthTypes.AuthCredential;
    const linkWithCredential = jest.fn().mockResolvedValue({});
    mockCurrentUser = { isAnonymous: true, linkWithCredential };

    await linkOrSignInWithCredential(credential);

    expect(linkWithCredential).toHaveBeenCalledWith(credential);
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('匿名ユーザーでない場合は通常サインインする', async () => {
    const credential = { providerId: 'apple.com' } as FirebaseAuthTypes.AuthCredential;
    mockCurrentUser = null;
    mockSignInWithCredential.mockResolvedValue({});

    await linkOrSignInWithCredential(credential);

    expect(mockSignInWithCredential).toHaveBeenCalledWith(credential);
  });

  it('既に同 credential の正規ユーザーが存在する場合は signInWithCredential にフォールバックする', async () => {
    const credential = { providerId: 'google.com' } as FirebaseAuthTypes.AuthCredential;
    const linkError = Object.assign(new Error('credential already in use'), {
      code: 'auth/credential-already-in-use',
    });
    const linkWithCredential = jest.fn().mockRejectedValue(linkError);
    mockCurrentUser = { isAnonymous: true, linkWithCredential };
    mockSignInWithCredential.mockResolvedValue({});

    await linkOrSignInWithCredential(credential);

    expect(linkWithCredential).toHaveBeenCalledWith(credential);
    expect(mockSignInWithCredential).toHaveBeenCalledWith(credential);
  });

  it('email already in use もフォールバックする', async () => {
    const credential = { providerId: 'apple.com' } as FirebaseAuthTypes.AuthCredential;
    const linkError = Object.assign(new Error('email already in use'), {
      code: 'auth/email-already-in-use',
    });
    const linkWithCredential = jest.fn().mockRejectedValue(linkError);
    mockCurrentUser = { isAnonymous: true, linkWithCredential };
    mockSignInWithCredential.mockResolvedValue({});

    await linkOrSignInWithCredential(credential);

    expect(mockSignInWithCredential).toHaveBeenCalledWith(credential);
  });

  it('フォールバック対象外のエラーはそのまま投げる', async () => {
    const credential = { providerId: 'google.com' } as FirebaseAuthTypes.AuthCredential;
    const networkError = Object.assign(new Error('network failed'), {
      code: 'auth/network-request-failed',
    });
    const linkWithCredential = jest.fn().mockRejectedValue(networkError);
    mockCurrentUser = { isAnonymous: true, linkWithCredential };

    await expect(linkOrSignInWithCredential(credential)).rejects.toBe(networkError);
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('既存ユーザーが匿名でない場合は link せず signIn する', async () => {
    const credential = { providerId: 'google.com' } as FirebaseAuthTypes.AuthCredential;
    const linkWithCredential = jest.fn();
    mockCurrentUser = { isAnonymous: false, linkWithCredential };
    mockSignInWithCredential.mockResolvedValue({});

    await linkOrSignInWithCredential(credential);

    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(mockSignInWithCredential).toHaveBeenCalledWith(credential);
  });
});

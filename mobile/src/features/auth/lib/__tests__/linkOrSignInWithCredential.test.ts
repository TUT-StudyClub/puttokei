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
});

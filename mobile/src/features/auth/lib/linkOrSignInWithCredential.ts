import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';

const LINK_FALLBACK_ERROR_CODES = new Set([
  'auth/credential-already-in-use',
  'auth/email-already-in-use',
]);

export async function linkOrSignInWithCredential(
  credential: FirebaseAuthTypes.AuthCredential,
): Promise<void> {
  const currentUser = auth().currentUser;
  if (currentUser?.isAnonymous) {
    try {
      await currentUser.linkWithCredential(credential);
      return;
    } catch (error) {
      if (!isLinkFallbackError(error)) throw error;
      // 既に同 provider で別アカウントが存在する場合は匿名 UID を諦め、既存アカウントへサインインする
      await auth().signInWithCredential(credential);
      return;
    }
  }

  await auth().signInWithCredential(credential);
}

function isLinkFallbackError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && LINK_FALLBACK_ERROR_CODES.has(code);
}

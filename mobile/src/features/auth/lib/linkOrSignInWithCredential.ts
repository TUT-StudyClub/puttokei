/**
 * 匿名ユーザーがいる場合は provider credential を link して Firebase UID を維持する。
 * 既に正式 provider でサインイン済み、または未サインインの場合は通常サインインする。
 */
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';

export async function linkOrSignInWithCredential(
  credential: FirebaseAuthTypes.AuthCredential,
): Promise<void> {
  const currentUser = auth().currentUser;
  if (currentUser?.isAnonymous) {
    await currentUser.linkWithCredential(credential);
    return;
  }

  await auth().signInWithCredential(credential);
}

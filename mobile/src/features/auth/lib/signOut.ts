/**
 * Firebase Auth からのサインアウト。
 *
 * `auth().signOut()` で Firebase 側のセッションを破棄し、
 * onIdTokenChanged が発火して authStore が clear される経路に委ねる。
 */
import auth from '@react-native-firebase/auth';

export async function signOut(): Promise<void> {
  await auth().signOut();
}

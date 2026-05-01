/**
 * Firebase Auth からのサインアウト。
 *
 * 通常は `auth().signOut()` → onIdTokenChanged 経由で authStore が clear
 * されるが、Keychain 永続化とメモリのみの authStore がねじれて
 * `[auth/no-current-user]` で落ちるケースがある。その場合は握りつぶし、
 * finally で authStore を明示 clear して詰みループを断つ。
 */
import auth from '@react-native-firebase/auth';

import { useAuthStore } from '@/shared/stores/authStore';

export async function signOut(): Promise<void> {
  try {
    await auth().signOut();
  } catch (error: unknown) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== 'auth/no-current-user') {
      throw error;
    }
  } finally {
    useAuthStore.getState().clear();
  }
}

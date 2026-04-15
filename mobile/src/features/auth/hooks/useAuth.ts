/**
 * 認証状態の派生ヘルパ。
 * - `isAuthenticated`: idToken がセット済みか
 * - 実際の Firebase サインイン処理は #32 で useAuth に追加する
 */
import { useAuthStore } from '@/shared/stores/authStore';

export function useAuth() {
  const uid = useAuthStore((s) => s.uid);
  const idToken = useAuthStore((s) => s.idToken);
  return {
    uid,
    idToken,
    isAuthenticated: uid !== null && idToken !== null,
  };
}

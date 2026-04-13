/**
 * 認証ロジック。Epic #2 で Firebase との連携を実装する。
 */
import { useAuthStore } from '@/shared/stores/authStore';

export function useAuth() {
  const uid = useAuthStore((s) => s.uid);
  return { uid, isAuthenticated: uid !== null };
}

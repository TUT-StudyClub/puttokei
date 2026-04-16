/**
 * DELETE /users/me のための useMutation hook。
 *
 * 成功時は QueryClient のキャッシュを全て破棄し、authStore からセッションを消すことで
 * AuthGate が自動的にサインイン画面へ戻す。Firebase Auth 上のサインアウトは呼び出し側
 * （SettingsScreen）の責務にして、副作用の責務を分離する。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteMyAccount } from '@/features/settings/api/settingsApi';
import { useAuthStore } from '@/shared/stores/authStore';

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clear);
  return useMutation<void, Error, void>({
    mutationFn: () => deleteMyAccount(),
    onSuccess: () => {
      queryClient.clear();
      clearAuth();
    },
  });
}

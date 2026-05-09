/**
 * DELETE /users/me のための useMutation hook。
 *
 * 成功時は次の順序で副作用を実行する。
 * 1. Firebase Auth から signOut() する。Backend 側で Firebase Auth ユーザは既に削除
 *    されているが、mobile プロセス内の `auth().currentUser` はメモリに残ったままなので
 *    明示サインアウトしないと、後続の ID Token 取得が「ユーザー未存在」で失敗ループに
 *    入り画面がローディングで固まる。
 * 2. QueryClient のキャッシュを全破棄する。退会後に同じ Firebase UID で
 *    新規ユーザーとして再登録された場合に古いデータが残らないようにする。
 *
 * `signOut()` の finally で `useAuthStore.clear()` が呼ばれるため、authStore の
 * クリアはここでは行わない。AuthGate が `uid===null` を検知して画面側で遷移する想定。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { signOut } from '@/features/auth/lib/signOut';
import { deleteMyAccount } from '@/features/settings/api/settingsApi';

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => deleteMyAccount(),
    onSuccess: async () => {
      // best-effort: signOut が失敗しても authStore は clear される (signOut.ts の finally)。
      await signOut().catch(() => undefined);
      queryClient.clear();
    },
  });
}

/**
 * PATCH /users/me/settings のための useMutation hook。
 * 成功時は SETTINGS_QUERY_KEY のキャッシュを直接更新する（再 fetch を抑える）。
 * notification_enabled が false に切り替わった場合は予約済みのフェーズ通知を
 * 即時キャンセルし、ユーザー操作と通知挙動の体感を一致させる。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateMySettings } from '@/features/settings/api/settingsApi';
import { SETTINGS_QUERY_KEY } from '@/features/settings/hooks/useSettings';
import { cancelAllScheduledSessionNotifications } from '@/shared/lib/notifications';
import type { UpdateUserSettingsInput, UserSettings } from '@/shared/types/userSettings';

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation<UserSettings, Error, UpdateUserSettingsInput>({
    mutationFn: (input) => updateMySettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData<UserSettings>(SETTINGS_QUERY_KEY, settings);
      if (settings.notification_enabled === false) {
        void cancelAllScheduledSessionNotifications();
      }
    },
  });
}

/**
 * PATCH /users/me/settings のための useMutation hook。
 * 成功時は SETTINGS_QUERY_KEY のキャッシュを直接更新する（再 fetch を抑える）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateMySettings } from '@/features/settings/api/settingsApi';
import { SETTINGS_QUERY_KEY } from '@/features/settings/hooks/useSettings';
import type { UpdateUserSettingsInput, UserSettings } from '@/shared/types/userSettings';

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation<UserSettings, Error, UpdateUserSettingsInput>({
    mutationFn: (input) => updateMySettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData<UserSettings>(SETTINGS_QUERY_KEY, settings);
    },
  });
}

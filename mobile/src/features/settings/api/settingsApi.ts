/**
 * GET / PATCH /api/v1/users/me/settings と DELETE /api/v1/users/me の API 呼び出し。
 */
import { api } from '@/shared/lib/api';
import type { UpdateUserSettingsInput, UserSettings } from '@/shared/types/userSettings';

export async function fetchMySettings(): Promise<UserSettings> {
  const { data } = await api.get<UserSettings>('/users/me/settings');
  return data;
}

export async function updateMySettings(input: UpdateUserSettingsInput): Promise<UserSettings> {
  const { data } = await api.patch<UserSettings>('/users/me/settings', input);
  return data;
}

export async function deleteMyAccount(): Promise<void> {
  await api.delete<void>('/users/me');
}

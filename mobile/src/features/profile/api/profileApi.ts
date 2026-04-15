/**
 * GET / PATCH /api/v1/users/me/profile の API 呼び出し。
 */
import { api } from '@/shared/lib/api';
import type { UpdateUserProfileInput, UserProfile } from '@/shared/types/user';

export async function fetchMyProfile(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/users/me/profile');
  return data;
}

export async function updateMyProfile(input: UpdateUserProfileInput): Promise<UserProfile> {
  const { data } = await api.patch<UserProfile>('/users/me/profile', input);
  return data;
}

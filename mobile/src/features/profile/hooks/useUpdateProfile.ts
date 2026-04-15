/**
 * PATCH /users/me/profile のための useMutation hook。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateMyProfile } from '@/features/profile/api/profileApi';
import { PROFILE_QUERY_KEY } from '@/features/profile/hooks/useProfile';
import type { UpdateUserProfileInput, UserProfile } from '@/shared/types/user';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation<UserProfile, Error, UpdateUserProfileInput>({
    mutationFn: (input) => updateMyProfile(input),
    onSuccess: (profile) => {
      queryClient.setQueryData<UserProfile>(PROFILE_QUERY_KEY, profile);
    },
  });
}

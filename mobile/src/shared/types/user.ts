/**
 * ユーザ / プロフィール関連の共通型。
 * backend の `src/domain/value_objects/age_group.py` の AgeGroup enum と対応する。
 */

export const AGE_GROUPS = ['teen', '20s', '30s', '40s', '50s', '60s_plus'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const AUTH_PROVIDERS = ['apple', 'google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export type UserProfile = {
  id: string;
  firebase_uid: string;
  auth_provider: AuthProvider;
  display_name: string | null;
  age_group: AgeGroup | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type UpdateUserProfileInput = {
  display_name?: string | null;
  age_group?: AgeGroup | null;
};

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  teen: '高校生以下',
  '20s': '20 代',
  '30s': '30 代',
  '40s': '40 代',
  '50s': '50 代',
  '60s_plus': '60 代以上',
};

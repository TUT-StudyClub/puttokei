/**
 * ユーザ設定（タイマー / 通知）の共通型。
 * backend の `src/domain/entities/user_settings.py` と
 * `src/presentation/schemas/user_settings_schema.py` のフィールド名と一致させる。
 */

export type UserSettings = {
  input_minutes: number;
  output_minutes: number;
  break_minutes: number;
  notification_enabled: boolean;
  updated_at: string;
};

/**
 * PATCH /users/me/settings の入力。すべてのフィールドが任意で、
 * 指定されたフィールドのみ更新される（部分更新）。
 */
export type UpdateUserSettingsInput = {
  input_minutes?: number;
  output_minutes?: number;
  break_minutes?: number;
  notification_enabled?: boolean;
};

/** タイマー値の許容範囲（backend のバリデーションと一致）。 */
export const TIMER_MINUTES_MIN = 1;
export const TIMER_MINUTES_MAX = 120;

/**
 * 設定画面のフォーム入力に対する Zod スキーマ。
 *
 * 画面側は TextInput で値を扱うため、フォームでは string で受け取り、submit 時に
 * `Number(value)` で変換する前提のスキーマと、変換後に backend へ送る `UpdateUserSettingsInput`
 * 用のスキーマを別に持つ。タイマーの境界値は backend と一致させる。
 */
import { z } from 'zod';

import { TIMER_MINUTES_MAX, TIMER_MINUTES_MIN } from '@/shared/types/userSettings';

const minutesField = z
  .string()
  .trim()
  .regex(/^\d+$/, '半角数字で入力してください')
  .transform((v) => Number(v))
  .pipe(
    z
      .number()
      .int()
      .min(TIMER_MINUTES_MIN, `${TIMER_MINUTES_MIN} 分以上を入力してください`)
      .max(TIMER_MINUTES_MAX, `${TIMER_MINUTES_MAX} 分以下を入力してください`),
  );

export const timerFormSchema = z.object({
  input_minutes: minutesField,
  output_minutes: minutesField,
  break_minutes: minutesField,
});

export type TimerFormValues = z.input<typeof timerFormSchema>;
export type TimerFormParsed = z.output<typeof timerFormSchema>;

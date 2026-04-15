/**
 * セッション開始フォームのデフォルト値とプリセット定義。
 *
 * 本来は `user_settings` API（Epic #5 / #6）から取得した値を用いるが、
 * 当該 API は未実装のため、要件書 4.3.2 の DEFAULT 値（20/5/5）に揃えた定数で代替する。
 * settings API 実装後は、`useDefaultTimer()` のようなフックでフェッチした値で上書きする想定。
 */

export const DEFAULT_TIMER = {
  input_minutes: 20,
  output_minutes: 5,
  break_minutes: 5,
} as const;

export const TIMER_PRESET_KEYS = ['recommended', 'custom'] as const;
export type TimerPresetKey = (typeof TIMER_PRESET_KEYS)[number];

export const TIMER_PRESET_LABELS: Record<TimerPresetKey, string> = {
  recommended: 'おすすめ (インプット20分 / アウトプット5分 / 休憩5分)',
  custom: 'カスタム',
};

export const TIMER_MIN = 1;
export const TIMER_MAX = 120;

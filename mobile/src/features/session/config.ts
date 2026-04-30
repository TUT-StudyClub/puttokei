/**
 * セッション開始時のデフォルト値。
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

export const HOURGLASS_SAND_COLORS = {
  input: '#148BFF',
  output: '#F24D7E',
  break: '#FFFFFF',
  mixed: '#BA64E8',
} as const;

export const HOURGLASS_BREAK_SAND_OPACITY = 0.92;

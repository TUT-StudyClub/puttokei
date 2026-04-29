/**
 * 統計機能で利用する型定義。
 * backend #54 の集計 API レスポンス仕様に対応する JSON 契約として扱う。
 */

import type { OutputReviewItem } from '@/shared/types/session';

export const STATS_PERIODS = ['daily', 'weekly', 'monthly'] as const;
export type Period = (typeof STATS_PERIODS)[number];

export type StatsSummary = {
  /** 期間中の総セッション数 */
  total_sessions: number;
  /** 期間中の総学習時間（分） */
  total_study_minutes: number;
  /** 期間中の平均正答率（0..1） */
  correct_rate: number;
  /** 連続学習日数 */
  streak_days: number;
  /** この summary が集計された期間種別 */
  period: Period;
  /** 集計開始日（ISO8601） */
  from: string;
  /** 集計終了日（ISO8601） */
  to: string;
};

export type StatsDataPoint = {
  /** バケット識別子。日は 'YYYY-MM-DD'、週は週頭日、月は 'YYYY-MM' */
  bucket: string;
  /** 表示用ラベル（例: '4/16', 'W16', '4月'） */
  label: string;
  /** 当該バケットのセッション数 */
  sessions: number;
  /** 当該バケットの学習時間（分） */
  study_minutes: number;
  /** 当該バケットの正答率（0..1） */
  correct_rate: number;
};

export type StatsPeriodResponse = {
  period: Period;
  points: StatsDataPoint[];
  summary: StatsSummary;
};

export type WeeklyReportSummary = {
  input_minutes: number;
  output_minutes: number;
  break_minutes: number;
  total_study_minutes: number;
  total_sessions: number;
};

export type WeeklyReportPoint = {
  bucket: string;
  label: string;
  study_minutes: number;
  sessions: number;
};

export type WeeklyReportResponse = {
  week_start: string;
  week_end: string;
  summary: WeeklyReportSummary;
  points: WeeklyReportPoint[];
  output_history: OutputReviewItem[];
};

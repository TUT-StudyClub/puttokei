/**
 * 統計 API。
 *
 * backend #54 が実装する `/api/v1/stats/*` エンドポイントを叩く。
 * baseURL は ApiClient 側で `/api/v1` が付与されるため相対パスで書く。
 */
import { api } from '@/shared/lib/api';

import type {
  DailyReportResponse,
  Period,
  StatsPeriodResponse,
  StatsSummary,
  WeeklyReportResponse,
} from '../types';

/**
 * サマリー統計 (GET /api/v1/stats/summary)。
 * 全期間の集計を返す想定。
 */
export async function fetchStatsSummary(): Promise<StatsSummary> {
  const { data } = await api.get<StatsSummary>('/stats/summary');
  return data;
}

/**
 * 期間別統計 (GET /api/v1/stats/{period})。
 * period は 'daily' | 'weekly' | 'monthly'。
 */
export async function fetchStatsByPeriod(period: Period): Promise<StatsPeriodResponse> {
  const { data } = await api.get<StatsPeriodResponse>(`/stats/${period}`);
  return data;
}

/**
 * 週単位レポート (GET /api/v1/stats/weekly?week_start=YYYY-MM-DD)。
 */
export async function fetchWeeklyReport(weekStart: string): Promise<WeeklyReportResponse> {
  const query = encodeURIComponent(weekStart);
  const { data } = await api.get<WeeklyReportResponse>(`/stats/weekly?week_start=${query}`);
  return data;
}

/**
 * 日単位レポート (GET /api/v1/stats/daily?date=YYYY-MM-DD)。
 */
export async function fetchDailyReport(date: string): Promise<DailyReportResponse> {
  const query = encodeURIComponent(date);
  const { data } = await api.get<DailyReportResponse>(`/stats/daily?date=${query}`);
  return data;
}

/**
 * statsApi の HTTP パス検証。
 *
 * `api.get` を spy してエンドポイントが期待通りに呼ばれることだけを確認する。
 * 実 HTTP 層の挙動 (Authorization 付与, 401 リトライ) は api.test.ts でカバー済み。
 */
import { api } from '@/shared/lib/api';
import { fetchStatsByPeriod, fetchStatsSummary } from '@/features/stats/api/statsApi';
import type { StatsPeriodResponse, StatsSummary } from '@/features/stats/types';

describe('statsApi', () => {
  const summaryFixture: StatsSummary = {
    total_sessions: 5,
    total_study_minutes: 125,
    correct_rate: 0.7,
    streak_days: 3,
    period: 'daily',
    from: '2026-04-14T00:00:00Z',
    to: '2026-04-15T23:59:59Z',
  };

  const periodFixture = (period: StatsPeriodResponse['period']): StatsPeriodResponse => ({
    period,
    points: [],
    summary: { ...summaryFixture, period },
  });

  let getSpy: jest.SpyInstance;

  beforeEach(() => {
    getSpy = jest.spyOn(api, 'get');
  });

  afterEach(() => {
    getSpy.mockRestore();
  });

  it('fetchStatsSummary は /stats/summary を叩く', async () => {
    getSpy.mockResolvedValueOnce({ data: summaryFixture, status: 200 });

    const result = await fetchStatsSummary();

    expect(getSpy).toHaveBeenCalledWith('/stats/summary');
    expect(result).toEqual(summaryFixture);
  });

  it.each(['daily', 'weekly', 'monthly'] as const)(
    'fetchStatsByPeriod(%s) は /stats/%s を叩く',
    async (period) => {
      getSpy.mockResolvedValueOnce({ data: periodFixture(period), status: 200 });

      const result = await fetchStatsByPeriod(period);

      expect(getSpy).toHaveBeenCalledWith(`/stats/${period}`);
      expect(result.period).toBe(period);
    },
  );
});

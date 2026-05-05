/**
 * statsApi の HTTP パス検証。
 *
 * `api.get` を spy してエンドポイントが期待通りに呼ばれることだけを確認する。
 * 実 HTTP 層の挙動 (Authorization 付与, 401 リトライ) は api.test.ts でカバー済み。
 */
import { api } from '@/shared/lib/api';
import {
  fetchDailyReport,
  fetchStatsByPeriod,
  fetchStatsSummary,
  fetchWeeklyReport,
  updateOutputSubject,
} from '@/features/stats/api/statsApi';
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
  let patchSpy: jest.SpyInstance;

  beforeEach(() => {
    getSpy = jest.spyOn(api, 'get');
    patchSpy = jest.spyOn(api, 'patch');
  });

  afterEach(() => {
    getSpy.mockRestore();
    patchSpy.mockRestore();
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

  it('fetchWeeklyReport は week_start 付きで /stats/weekly を叩く', async () => {
    const weeklyFixture = {
      week_start: '2026-04-26',
      week_end: '2026-05-02',
      summary: {
        input_minutes: 50,
        output_minutes: 20,
        break_minutes: 15,
        total_study_minutes: 70,
        total_sessions: 2,
      },
      points: [],
      output_history: [],
    };
    getSpy.mockResolvedValueOnce({ data: weeklyFixture, status: 200 });

    const result = await fetchWeeklyReport('2026-04-26');

    expect(getSpy).toHaveBeenCalledWith('/stats/weekly?week_start=2026-04-26');
    expect(result).toEqual(weeklyFixture);
  });

  it('fetchDailyReport は date 付きで /stats/daily を叩く', async () => {
    const dailyFixture = {
      date: '2026-04-29',
      summary: {
        input_minutes: 50,
        output_minutes: 20,
        break_minutes: 15,
        total_study_minutes: 70,
        total_sessions: 2,
      },
      output_history: [],
    };
    getSpy.mockResolvedValueOnce({ data: dailyFixture, status: 200 });

    const result = await fetchDailyReport('2026-04-29');

    expect(getSpy).toHaveBeenCalledWith('/stats/daily?date=2026-04-29');
    expect(result).toEqual(dailyFixture);
  });

  it('updateOutputSubject は output id 付きで /sessions/outputs/{id}/subject を叩く', async () => {
    const fixture = {
      output_id: 'out-1',
      subject_id: 'subject-1',
      subject: '数学',
      subject_color: '#FF9147',
      updated_at: '2026-05-03T12:00:00Z',
    };
    patchSpy.mockResolvedValueOnce({ data: fixture, status: 200 });

    const result = await updateOutputSubject('out-1', {
      label: '数学',
      color: '#FF9147',
    });

    expect(patchSpy).toHaveBeenCalledWith('/sessions/outputs/out-1/subject', {
      label: '数学',
      color: '#FF9147',
    });
    expect(result).toEqual(fixture);
  });
});

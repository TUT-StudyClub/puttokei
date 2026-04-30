import {
  buildMonthlyHighlightSummary,
  getMonthCalendarDateKeys,
  getMonthWeekStartKeys,
} from '@/features/stats/lib/monthlyReport';
import type { WeeklyReportResponse } from '@/features/stats/types';

function weeklyReport(points: { bucket: string; study_minutes: number }[]): WeeklyReportResponse {
  const lastPoint = points[points.length - 1];
  return {
    week_start: points[0]?.bucket ?? '2026-04-01',
    week_end: lastPoint?.bucket ?? '2026-04-07',
    summary: {
      input_minutes: 0,
      output_minutes: 0,
      break_minutes: 0,
      total_study_minutes: 0,
      total_sessions: 0,
    },
    points: points.map((point) => ({
      bucket: point.bucket,
      label: point.bucket.slice(8),
      study_minutes: point.study_minutes,
      sessions: point.study_minutes > 0 ? 1 : 0,
    })),
    output_history: [],
  };
}

describe('monthlyReport', () => {
  it('月カレンダーの先頭空白と末尾空白を含む 7 列グリッドを返す', () => {
    const cells = getMonthCalendarDateKeys('2026-04-01');

    expect(cells.slice(0, 4)).toEqual([null, null, null, '2026-04-01']);
    expect(cells.length % 7).toBe(0);
    expect(cells).toContain('2026-04-30');
  });

  it('月表示に必要な週開始日を月またぎ込みで返す', () => {
    expect(getMonthWeekStartKeys('2026-04-01')).toEqual([
      '2026-03-29',
      '2026-04-05',
      '2026-04-12',
      '2026-04-19',
      '2026-04-26',
    ]);
  });

  it('月内の学習日数と最長連続日数を集計する', () => {
    const reports = [
      weeklyReport([
        { bucket: '2026-04-01', study_minutes: 20 },
        { bucket: '2026-04-02', study_minutes: 20 },
        { bucket: '2026-04-04', study_minutes: 0 },
      ]),
      weeklyReport([
        { bucket: '2026-04-05', study_minutes: 10 },
        { bucket: '2026-04-06', study_minutes: 10 },
        { bucket: '2026-04-07', study_minutes: 10 },
        { bucket: '2026-05-01', study_minutes: 10 },
      ]),
    ];

    expect(buildMonthlyHighlightSummary(reports, '2026-04-01')).toEqual({
      totalDays: 5,
      longestStreakDays: 3,
    });
  });
});

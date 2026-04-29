import {
  addDaysToDateKey,
  parseDateKey,
  toDateKey,
} from '@/features/stats/lib/week';
import type { WeeklyReportResponse } from '@/features/stats/types';

export type MonthlyHighlightSummary = {
  totalDays: number;
  longestStreakDays: number;
};

export function getMonthStartKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  date.setDate(1);
  return toDateKey(date);
}

export function addMonthsToMonthStartKey(monthStartKey: string, months: number): string {
  const monthStart = parseDateKey(monthStartKey);
  const shifted = new Date(monthStart.getFullYear(), monthStart.getMonth() + months, 1);
  return toDateKey(shifted);
}

export function getMonthCalendarDateKeys(monthStartKey: string): (string | null)[] {
  const monthStart = parseDateKey(monthStartKey);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: monthStart.getDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toDateKey(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function getMonthWeekStartKeys(monthStartKey: string): string[] {
  const monthStart = parseDateKey(monthStartKey);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const monthEnd = new Date(year, month + 1, 0);
  const gridStart = new Date(year, month, 1 - monthStart.getDay());
  const gridEnd = new Date(year, month, monthEnd.getDate() + (6 - monthEnd.getDay()));
  const weekStarts: string[] = [];

  for (
    const cursor = new Date(gridStart);
    cursor <= gridEnd;
    cursor.setDate(cursor.getDate() + 7)
  ) {
    weekStarts.push(toDateKey(cursor));
  }
  return weekStarts;
}

export function getStudiedDateKeySet(reports: readonly WeeklyReportResponse[]): Set<string> {
  const studiedDateKeys = new Set<string>();
  reports.forEach((report) => {
    report.points.forEach((point) => {
      if (point.study_minutes > 0) {
        studiedDateKeys.add(point.bucket);
      }
    });
  });
  return studiedDateKeys;
}

export function getMonthlyStudiedDateKeys(
  reports: readonly WeeklyReportResponse[],
  monthStartKey: string,
): string[] {
  const monthPrefix = monthStartKey.slice(0, 7);
  return Array.from(getStudiedDateKeySet(reports))
    .filter((dateKey) => dateKey.startsWith(monthPrefix))
    .sort();
}

export function buildMonthlyHighlightSummary(
  reports: readonly WeeklyReportResponse[],
  monthStartKey: string,
): MonthlyHighlightSummary {
  const studiedDateKeys = getMonthlyStudiedDateKeys(reports, monthStartKey);
  let longestStreakDays = 0;
  let currentStreakDays = 0;
  let previousDateKey: string | null = null;

  studiedDateKeys.forEach((dateKey) => {
    if (previousDateKey !== null && addDaysToDateKey(previousDateKey, 1) === dateKey) {
      currentStreakDays += 1;
    } else {
      currentStreakDays = 1;
    }
    longestStreakDays = Math.max(longestStreakDays, currentStreakDays);
    previousDateKey = dateKey;
  });

  return {
    totalDays: studiedDateKeys.length,
    longestStreakDays,
  };
}

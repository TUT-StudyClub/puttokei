const TOKYO_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '01';
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDateKey(dateKey: string): Date {
  const [year = '1970', month = '1', day = '1'] = dateKey.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function getTokyoDateKey(date = new Date()): string {
  const parts = TOKYO_DATE_FORMATTER.formatToParts(date);
  return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}`;
}

export function getSundayWeekStartKey(date = new Date()): string {
  const tokyoToday = parseDateKey(getTokyoDateKey(date));
  tokyoToday.setDate(tokyoToday.getDate() - tokyoToday.getDay());
  return toDateKey(tokyoToday);
}

export function getWeekDateKeys(weekStartKey: string): string[] {
  return Array.from({ length: 7 }, (_value, index) => addDaysToDateKey(weekStartKey, index));
}

export function getMonthLabel(weekStartKey: string): string {
  const weekStart = parseDateKey(weekStartKey);
  return `${weekStart.getMonth() + 1}月`;
}

export function getDateNumberLabel(dateKey: string): string {
  return String(parseDateKey(dateKey).getDate());
}

import type { JudgmentVerdict } from '@/features/session/types';

export const JUDGMENT_VERDICT_LABELS: Record<JudgmentVerdict, string> = {
  correct: 'Good',
  partial: 'Partial',
  incorrect: 'Needs Work',
  rejected: 'Rejected',
};

export const JUDGMENT_VERDICT_COLORS: Record<JudgmentVerdict, string> = {
  correct: '$green10',
  partial: '$orange10',
  incorrect: '$red10',
  rejected: '$red10',
};

const judgedAtFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatJudgedAt(value: string): string {
  return judgedAtFormatter.format(new Date(value));
}

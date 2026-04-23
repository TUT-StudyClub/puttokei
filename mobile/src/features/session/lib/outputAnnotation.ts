/**
 * アウトプット本文と判定結果の誤り指摘から、赤ハイライト用のセグメントを組み立てる。
 */
import type { JudgmentCorrection } from '@/features/session/types';

export type OutputSegment =
  | { type: 'plain'; text: string }
  | { type: 'correction'; text: string; correctionIndex: number };

/**
 * 本文中の `target_text` 出現位置をすべて探し、重ならないようにセグメント化する。
 *
 * - 同じ target_text が複数回現れても全て赤色扱いにする(同じ correctionIndex を付ける)。
 * - 複数の correction が重なる場合は先に現れたものを優先し、後続の重複部分は捨てる。
 * - target_text が空文字の correction は無視する。
 */
export function buildOutputSegments(
  content: string,
  corrections: readonly JudgmentCorrection[],
): OutputSegment[] {
  if (content.length === 0) return [];
  if (corrections.length === 0) return [{ type: 'plain', text: content }];

  type Match = { start: number; end: number; correctionIndex: number };
  const matches: Match[] = [];

  corrections.forEach((correction, correctionIndex) => {
    const target = correction.target_text;
    if (target.length === 0) return;
    let cursor = 0;
    while (cursor <= content.length - target.length) {
      const found = content.indexOf(target, cursor);
      if (found === -1) break;
      matches.push({ start: found, end: found + target.length, correctionIndex });
      cursor = found + target.length;
    }
  });

  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });

  const nonOverlapping: Match[] = [];
  let nextStart = 0;
  for (const match of matches) {
    if (match.start >= nextStart) {
      nonOverlapping.push(match);
      nextStart = match.end;
    }
  }

  const segments: OutputSegment[] = [];
  let cursor = 0;
  for (const match of nonOverlapping) {
    if (match.start > cursor) {
      segments.push({ type: 'plain', text: content.slice(cursor, match.start) });
    }
    segments.push({
      type: 'correction',
      text: content.slice(match.start, match.end),
      correctionIndex: match.correctionIndex,
    });
    cursor = match.end;
  }
  if (cursor < content.length) {
    segments.push({ type: 'plain', text: content.slice(cursor) });
  }
  return segments;
}

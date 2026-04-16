/**
 * セッション関連の共通型。
 * backend の `src/domain/value_objects/session_status.py` および
 * `src/presentation/schemas/session_schema.py` と対応する。
 */

export const SESSION_STATUSES = ['input', 'output', 'judging', 'judged', 'cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export const JUDGMENT_VERDICTS = ['correct', 'partial', 'incorrect', 'rejected'] as const;
export type JudgmentVerdict = (typeof JUDGMENT_VERDICTS)[number];

export type Session = {
  id: string;
  user_id: string;
  status: SessionStatus;
  subject: string;
  topic: string;
  input_minutes: number;
  output_minutes: number;
  break_minutes: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type CreateSessionInput = {
  subject: string;
  topic: string;
  input_minutes: number;
  output_minutes: number;
  break_minutes: number;
};

export type Output = {
  id: string;
  session_id: string;
  content: string;
  submitted_at: string;
};

export type SubmitOutputResponse = {
  output: Output;
  status: SessionStatus;
};

/**
 * アウトプット送信リクエスト。
 * backend の `POST /api/v1/sessions/{id}/output` と対応する。
 * `submitted_at` は ISO8601 (JST) のタイムスタンプ文字列。
 */
export type SubmitOutputInput = {
  content: string;
  submitted_at: string;
};

export type JudgmentItem = {
  label: string;
  comment: string;
};

export type Judgment = {
  id: string;
  session_id: string;
  verdict: JudgmentVerdict;
  score: number;
  advice: string;
  items: JudgmentItem[];
  judged_at: string;
};

export type JudgmentPending = {
  status: 'pending';
  detail: string;
  retry_after_seconds: number;
  estimated_ready_at: string;
};

export type JudgmentFetchResult =
  | { kind: 'ready'; judgment: Judgment }
  | { kind: 'pending'; pending: JudgmentPending };

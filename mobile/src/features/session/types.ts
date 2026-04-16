/**
 * セッション関連の共通型。
 * backend の `src/domain/value_objects/session_status.py` および
 * `src/presentation/schemas/session_schema.py` と対応する。
 */

export const SESSION_STATUSES = ['input', 'output', 'judging', 'judged', 'cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

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

/**
 * アウトプット送信リクエスト。
 * backend の `POST /api/v1/sessions/{id}/output` と対応する。
 * `submitted_at` は ISO8601 (JST) のタイムスタンプ文字列。
 */
export type SubmitOutputInput = {
  content: string;
  submitted_at: string;
};

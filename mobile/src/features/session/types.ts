/**
 * セッション関連の共通型。
 * backend の `src/domain/value_objects/session_status.py` および
 * `src/presentation/schemas/session_schema.py` と対応する。
 */

export const SESSION_STATUSES = ['input', 'output', 'judging', 'judged', 'cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export const JUDGMENT_VERDICTS = ['correct', 'partial', 'incorrect', 'rejected'] as const;
export type JudgmentVerdict = (typeof JUDGMENT_VERDICTS)[number];
export const OUTPUT_KINDS = ['text', 'image'] as const;
export type OutputKind = (typeof OUTPUT_KINDS)[number];

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
  kind: OutputKind;
  content: string | null;
  image_url: string | null;
  submitted_at: string;
};

export type SubmitOutputResponse = {
  output: Output;
  status: SessionStatus;
};

export type UpdateOutputSubjectInput = {
  label: string;
  color: string;
};

export type OutputSubjectAssignment = {
  output_id: string;
  subject_id: string;
  subject: string;
  subject_color: string;
  updated_at: string;
};

/**
 * テキストアウトプット送信リクエスト。
 * backend の `POST /api/v1/sessions/{id}/outputs/text` に対応する。
 * `submitted_at` は ISO8601 (JST) のタイムスタンプ文字列。
 */
export type SubmitTextOutputInput = {
  content: string;
  submitted_at: string;
};

/**
 * 画像アウトプット送信リクエスト。
 * backend の `POST /api/v1/sessions/{id}/outputs/image` に対応する。
 * `image_storage_path` はアップロード URL 発行時に backend から渡される値。
 */
export type SubmitImageOutputInput = {
  image_storage_path: string;
  submitted_at: string;
};

/**
 * 画像アップロード URL 発行レスポンス。
 * `upload_url` は GCS への直接 PUT を許可する短期 signed URL。
 */
export type IssueOutputImageUploadUrlResponse = {
  upload_url: string;
  storage_path: string;
  expires_at: string;
};

/**
 * 画像アップロード URL 発行で許可される MIME type。backend と揃える。
 */
export const OUTPUT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export type OutputImageMimeType = (typeof OUTPUT_IMAGE_MIME_TYPES)[number];

/**
 * 画像内の領域を 0〜1 正規化座標で表す。画像左上が原点。
 * backend の `BoundingBox` と対応する。
 */
export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * アウトプット中の誤りに対する指摘。
 * backend の `JudgmentCorrection` と対応する。
 * UI 側ではユーザー文中の `target_text` を赤ハイライトし、タップで正解と解説を出す。
 * 画像判定の場合は `bbox` に基づいて画像上に赤下線を重ねて表示する。
 */
export type JudgmentCorrection = {
  target_text: string;
  correct_text: string;
  explanation: string;
  bbox?: BoundingBox | null;
};

export type Judgment = {
  id: string;
  session_id: string;
  verdict: JudgmentVerdict;
  score: number;
  advice: string;
  corrections: JudgmentCorrection[];
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

export const JUDGMENT_PROGRESS_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
export type JudgmentProgressStatus = (typeof JUDGMENT_PROGRESS_STATUSES)[number];

export const JUDGMENT_PROGRESS_STAGES = [
  'queued',
  'downloading_image',
  'encoding_image',
  'preparing_prompt',
  'requesting_llm',
  'receiving_llm',
  'validating_response',
  'saving_result',
  'completed',
  'failed',
] as const;
export type JudgmentProgressStage = (typeof JUDGMENT_PROGRESS_STAGES)[number];

export type JudgmentProgress = {
  status: JudgmentProgressStatus;
  stage: JudgmentProgressStage;
  percent: number;
  message: string;
  updated_at: string;
  completed_at: string | null;
  error_code: string | null;
};

export type OutputReviewItem = {
  session_id: string;
  session_started_at: string;
  input_minutes: number;
  output_minutes: number;
  output: Output;
  cycle_index: number;
  subject: string;
  subject_id: string | null;
  subject_color: string | null;
  topic: string;
  judgment: Judgment | null;
};

export type TodayOutputsResponse = {
  items: OutputReviewItem[];
};

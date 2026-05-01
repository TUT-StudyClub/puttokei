/**
 * `/api/v1/sessions` 系の API 呼び出し。
 */
import { api } from '@/shared/lib/api';
import type {
  CreateSessionInput,
  IssueOutputImageUploadUrlResponse,
  Judgment,
  JudgmentFetchResult,
  JudgmentPending,
  JudgmentProgress,
  OutputImageMimeType,
  Session,
  SessionStatus,
  SubmitImageOutputInput,
  SubmitOutputResponse,
  SubmitTextOutputInput,
  TodayOutputsResponse,
} from '@/features/session/types';

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const { data } = await api.post<Session>('/sessions', input);
  return data;
}

/**
 * フェーズ遷移に伴い session.status を更新する。
 * 許可される遷移はサーバ側の状態遷移表で絞り込まれる。
 */
export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): Promise<Session> {
  const { data } = await api.patch<Session>(`/sessions/${sessionId}`, { status });
  return data;
}

/**
 * テキストアウトプットを backend に送る。
 */
export async function submitTextOutput(
  sessionId: string,
  input: SubmitTextOutputInput,
): Promise<SubmitOutputResponse> {
  const { data } = await api.post<SubmitOutputResponse>(
    `/sessions/${sessionId}/outputs/text`,
    input,
  );
  return data;
}

/**
 * GCS へアップロード済みの画像 path を backend に submit する。
 */
export async function submitImageOutput(
  sessionId: string,
  input: SubmitImageOutputInput,
): Promise<SubmitOutputResponse> {
  const { data } = await api.post<SubmitOutputResponse>(
    `/sessions/${sessionId}/outputs/image`,
    input,
  );
  return data;
}

/**
 * 画像アウトプット用に GCS への直接アップロード URL を発行してもらう。
 */
export async function issueOutputImageUploadUrl(
  sessionId: string,
  mimeType: OutputImageMimeType,
): Promise<IssueOutputImageUploadUrlResponse> {
  const { data } = await api.post<IssueOutputImageUploadUrlResponse>(
    `/sessions/${sessionId}/outputs/image/upload-url`,
    { mime_type: mimeType },
  );
  return data;
}

/**
 * 判定結果を取得する。未完了の場合は 202 pending を返す。
 */
export async function getJudgment(sessionId: string): Promise<JudgmentFetchResult> {
  const response = await api.get<Judgment | JudgmentPending>(`/sessions/${sessionId}/judgment`);

  if (response.status === 202) {
    return { kind: 'pending', pending: response.data as JudgmentPending };
  }

  return { kind: 'ready', judgment: response.data as Judgment };
}

/**
 * 判定進捗の現在値を取得する。
 */
export async function getJudgmentProgress(sessionId: string): Promise<JudgmentProgress> {
  const { data } = await api.get<JudgmentProgress>(`/sessions/${sessionId}/judgment/progress`);
  return data;
}

export async function listTodayOutputs(): Promise<TodayOutputsResponse> {
  const { data } = await api.get<TodayOutputsResponse>('/sessions/outputs/today');
  return data;
}

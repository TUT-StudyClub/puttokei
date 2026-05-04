/**
 * 共通 HTTP クライアント。
 *
 * fetch を薄くラップし、以下の責務を持たせる。
 * - Authorization ヘッダーへ Firebase ID Token を自動で差し込む（自動付与）
 * - 401 を受けたら refresher を呼んで ID Token を再取得し 1 回だけリトライする（自動更新）
 *
 * トークン取得・更新ロジックは `setTokenProvider` / `setTokenRefresher` で差し込む。
 * 実装は Epic #2（Firebase Auth 初期化）で authStore から注入する。
 */
import Constants from 'expo-constants';

import type { ProblemDetails } from '@/shared/types/api';

type TokenProvider = () => Promise<string | null> | string | null;
type TokenRefresher = () => Promise<string | null>;
type ApiResponse<T> = {
  data: T;
  status: number;
};

let tokenProvider: TokenProvider = () => null;
let tokenRefresher: TokenRefresher | null = null;

/**
 * 認証トークンの取得関数を差し込む。
 * authStore から最新の idToken を読み出す形で渡す想定。
 */
export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

/**
 * 期限切れトークンの再取得関数を差し込む。
 * Firebase Auth の `getIdToken(true)` に対応する関数を渡す想定。
 * 再取得後は authStore に反映してから最新値を return する。
 * 未設定の場合は 401 リトライを行わない。
 */
export function setTokenRefresher(refresher: TokenRefresher | null): void {
  tokenRefresher = refresher;
}

const baseURL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:8080/api/v1';

const DEFAULT_TIMEOUT_MS = 15_000;

export function buildApiUrl(path: string): string {
  const normalizedBaseUrl = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

async function buildHeaders(init?: HeadersInit, overrideToken?: string | null): Promise<Headers> {
  const headers = new Headers(init);
  const token = overrideToken !== undefined ? overrideToken : await tokenProvider();

  headers.set('Accept', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.delete('Authorization');
  }

  return headers;
}

async function parseResponseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== 'object' || value === null) return false;

  const maybeProblem = value as Partial<ProblemDetails>;
  return (
    typeof maybeProblem.type === 'string' &&
    typeof maybeProblem.title === 'string' &&
    typeof maybeProblem.status === 'number'
  );
}

export class ApiError extends Error {
  status: number;
  problem?: ProblemDetails;

  constructor(status: number, problem?: ProblemDetails) {
    super(`HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

class ApiClient {
  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async postMultipart<T>(path: string, form: FormData): Promise<ApiResponse<T>> {
    // Content-Type は指定しない: FormData が boundary 付きで自動設定する。
    return this.request<T>(path, {
      method: 'POST',
      body: form as unknown as BodyInit,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  private async request<T>(path: string, init: RequestInit): Promise<ApiResponse<T>> {
    const response = await this.fetchWithAuth(path, init);
    const data = await parseResponseBody<T | ProblemDetails>(response);

    if (!response.ok) {
      throw new ApiError(response.status, isProblemDetails(data) ? data : undefined);
    }

    return { data: data as T, status: response.status };
  }

  /**
   * 1 回目を現在のトークンで送り、401 の場合だけ refresher を呼んで再送する。
   * refresher が未設定、または refresher が null を返したときはそのまま 401 を返す。
   */
  private async fetchWithAuth(path: string, init: RequestInit): Promise<Response> {
    const firstResponse = await this.fetchOnce(path, init);
    if (firstResponse.status !== 401 || tokenRefresher === null) {
      return firstResponse;
    }

    const refreshedToken = await tokenRefresher();
    if (refreshedToken === null) {
      return firstResponse;
    }

    return this.fetchOnce(path, init, refreshedToken);
  }

  private async fetchOnce(
    path: string,
    init: RequestInit,
    overrideToken?: string | null,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const headers = await buildHeaders(init.headers, overrideToken);
      return await fetch(buildApiUrl(path), {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const api = new ApiClient();

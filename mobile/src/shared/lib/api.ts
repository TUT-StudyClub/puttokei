/**
 * 共通 HTTP クライアント。
 *
 * 共通ラッパー経由で fetch を利用し、Authorization ヘッダーへ
 * Firebase ID Token を自動で差し込む。
 * トークン取得ロジックは Epic #2 で `authStore` から注入する。
 */
import Constants from 'expo-constants';

type TokenProvider = () => Promise<string | null> | string | null;
type ApiResponse<T> = {
  data: T;
};

let tokenProvider: TokenProvider = () => null;

/**
 * 認証トークンの取得関数を差し込む。
 * Epic #2 で authStore.getIdToken を渡す想定。
 */
export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

const baseURL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:8080/api/v1';

const DEFAULT_TIMEOUT_MS = 15_000;

function buildUrl(path: string): string {
  const normalizedBaseUrl = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

async function buildHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init);
  const token = await tokenProvider();

  headers.set('Accept', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
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

class ApiClient {
  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET' });
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const headers = await buildHeaders({ 'Content-Type': 'application/json' });

    return this.request<T>(path, {
      method: 'PATCH',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const headers = init.headers instanceof Headers ? init.headers : await buildHeaders(init.headers);
      const response = await fetch(buildUrl(path), {
        ...init,
        headers,
        signal: controller.signal,
      });
      const data = await parseResponseBody<T>(response);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return { data };
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

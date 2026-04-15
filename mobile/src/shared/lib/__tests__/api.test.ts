/**
 * api.ts の Authorization 付与と 401 時の自動リフレッシュ挙動を検証する。
 *
 * fetch はグローバルをモックし、tokenProvider / tokenRefresher は
 * このテスト内で差し込む。
 */
import { api, setTokenProvider, setTokenRefresher } from '../api';

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

const originalFetch = global.fetch;

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getAuthHeader(call: [RequestInfo | URL, RequestInit?]): string | null {
  const init = call[1];
  if (init === undefined) return null;
  const headers = init.headers;
  if (headers instanceof Headers) {
    return headers.get('Authorization');
  }
  return null;
}

describe('api', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    setTokenProvider(() => null);
    setTokenRefresher(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('tokenProvider が返した ID Token を Authorization ヘッダーに付与する', async () => {
    setTokenProvider(() => 'token-initial');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await api.get('/users/me/profile');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAuthHeader(fetchMock.mock.calls[0]!)).toBe('Bearer token-initial');
  });

  it('tokenProvider が null を返したときは Authorization を付けない', async () => {
    setTokenProvider(() => null);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await api.get('/users/me/profile');

    expect(getAuthHeader(fetchMock.mock.calls[0]!)).toBeNull();
  });

  it('401 を受けたら tokenRefresher を呼び、取得した新トークンで 1 回だけ再送する', async () => {
    setTokenProvider(() => 'token-expired');
    const refresher = jest.fn<Promise<string | null>, []>().mockResolvedValue('token-fresh');
    setTokenRefresher(refresher);

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'u1' }));

    const result = await api.get<{ id: string }>('/users/me/profile');

    expect(result.data).toEqual({ id: 'u1' });
    expect(refresher).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAuthHeader(fetchMock.mock.calls[0]!)).toBe('Bearer token-expired');
    expect(getAuthHeader(fetchMock.mock.calls[1]!)).toBe('Bearer token-fresh');
  });

  it('tokenRefresher が null を返したときは再送せず 401 を失敗として返す', async () => {
    setTokenProvider(() => 'token-expired');
    const refresher = jest.fn<Promise<string | null>, []>().mockResolvedValue(null);
    setTokenRefresher(refresher);

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'expired' }));

    await expect(api.get('/users/me/profile')).rejects.toThrow('HTTP 401');
    expect(refresher).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tokenRefresher が未設定のときは 401 を受けても再送しない', async () => {
    setTokenProvider(() => 'token-expired');
    setTokenRefresher(null);

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'expired' }));

    await expect(api.get('/users/me/profile')).rejects.toThrow('HTTP 401');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('200 のときは tokenRefresher を呼ばない', async () => {
    setTokenProvider(() => 'token-initial');
    const refresher = jest.fn<Promise<string | null>, []>().mockResolvedValue('token-fresh');
    setTokenRefresher(refresher);

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await api.get('/users/me/profile');

    expect(refresher).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

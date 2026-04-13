/**
 * 共通 HTTP クライアント。
 *
 * 要件書 §2.1 に従い Axios を採用し、Authorization ヘッダーは
 * Firebase ID Token を request interceptor で差し込む。
 * トークン取得ロジックは Epic #2 で `authStore` から注入する。
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';

type TokenProvider = () => Promise<string | null> | string | null;

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

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenProvider();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

import { api } from '@/shared/lib/api';

type VerifyResponse = {
  user: {
    id: string;
    firebase_uid: string;
    auth_provider: string;
  };
  is_new: boolean;
};

/**
 * Firebase 認証後に backend へユーザー登録 / 検証を行う。
 *
 * 呼び出し口は Issue #33 で `POST /api/v1/auth/verify` が実装された後に `useSignIn`
 * から戻す。現状は export のみ残しており、未使用。
 */
export async function verifyAuth(): Promise<VerifyResponse> {
  const { data } = await api.post<VerifyResponse>('/auth/verify');
  return data;
}

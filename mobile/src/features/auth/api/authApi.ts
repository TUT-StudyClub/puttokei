import { api } from '@/shared/lib/api';

type VerifyResponse = {
  user: {
    id: string;
    firebase_uid: string;
    auth_provider: string;
  };
  is_new: boolean;
};

/** Firebase 認証後に backend へユーザー登録 / 検証を行う。 */
export async function verifyAuth(): Promise<VerifyResponse> {
  const { data } = await api.post<VerifyResponse>('/auth/verify');
  return data;
}

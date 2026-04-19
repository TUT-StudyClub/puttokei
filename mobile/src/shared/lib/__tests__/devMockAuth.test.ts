/**
 * devMockAuth の挙動を検証する。
 *
 * 固定 UID を `subscribeIdTokenChanged` のリスナーへ通知し、
 * `refreshIdToken` で同じトークンを返すことを確認する。
 */
import {
  refreshIdToken,
  resetAuthImpl,
  subscribeIdTokenChanged,
  type AuthSession,
} from '@/shared/lib/firebase';

import {
  DEV_MOCK_UID,
  _resetDevMockAuthForTest,
  installDevMockAuth,
} from '@/shared/lib/devMockAuth';

describe('devMockAuth', () => {
  beforeEach(() => {
    resetAuthImpl();
    _resetDevMockAuthForTest();
  });

  it('installDevMockAuth 後に subscribe すると固定 UID の session が通知される', () => {
    installDevMockAuth();

    const listener = jest.fn<void, [AuthSession | null]>();
    subscribeIdTokenChanged(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      uid: DEV_MOCK_UID,
      idToken: `dev-mock-${DEV_MOCK_UID}`,
    });
  });

  it('refreshIdToken は現在のトークンを返す', async () => {
    installDevMockAuth();
    await expect(refreshIdToken()).resolves.toBe(`dev-mock-${DEV_MOCK_UID}`);
  });
});

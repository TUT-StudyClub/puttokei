/**
 * firebase.ts の差し込み機構（registerAuthImpl / subscribe / refresh）を検証する。
 * 実 Firebase SDK は呼ばず、差し込み口のデフォルト挙動と差し替え挙動だけを確認する。
 */
import {
  refreshIdToken,
  registerAuthImpl,
  resetAuthImpl,
  subscribeIdTokenChanged,
  type AuthSession,
} from '../firebase';

describe('firebase auth 差し込み', () => {
  afterEach(() => {
    resetAuthImpl();
  });

  it('未登録のとき subscribe は何もせず unsubscribe だけ返す', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeIdTokenChanged(listener);

    expect(listener).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('未登録のとき refreshIdToken は null を返す', async () => {
    await expect(refreshIdToken()).resolves.toBeNull();
  });

  it('registerAuthImpl で差し込んだ subscribe が呼ばれ、listener に session が届く', () => {
    const listener = jest.fn();
    const unsubscribeSpy = jest.fn();
    const subscribeSpy = jest.fn((l: (session: AuthSession | null) => void) => {
      l({ uid: 'u1', idToken: 'token-1' });
      return unsubscribeSpy;
    });

    registerAuthImpl({
      subscribeIdTokenChanged: subscribeSpy,
      refreshIdToken: async () => null,
    });

    const unsubscribe = subscribeIdTokenChanged(listener);
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ uid: 'u1', idToken: 'token-1' });

    unsubscribe();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it('registerAuthImpl で差し込んだ refresh が呼ばれ、返値がそのまま返る', async () => {
    const refreshSpy = jest.fn<Promise<string | null>, []>().mockResolvedValue('token-fresh');
    registerAuthImpl({
      subscribeIdTokenChanged: () => () => {},
      refreshIdToken: refreshSpy,
    });

    await expect(refreshIdToken()).resolves.toBe('token-fresh');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('resetAuthImpl で差し込みが初期状態に戻る', async () => {
    registerAuthImpl({
      subscribeIdTokenChanged: () => () => {},
      refreshIdToken: async () => 'token-fresh',
    });

    resetAuthImpl();

    await expect(refreshIdToken()).resolves.toBeNull();
  });
});

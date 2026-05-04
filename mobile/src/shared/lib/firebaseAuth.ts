/**
 * Firebase Auth の実装を firebase.ts の DI 口に差し込むモジュール。
 *
 * @react-native-firebase/auth の onIdTokenChanged / getIdToken を使い、
 * AuthImpl インターフェースを満たす実装を登録する。
 */
import auth from '@react-native-firebase/auth';

import { type AuthImpl, registerAuthImpl } from './firebase';

function createFirebaseAuthImpl(): AuthImpl {
  return {
    subscribeIdTokenChanged(listener) {
      return auth().onIdTokenChanged(async (user) => {
        if (user === null) {
          listener(null);
          return;
        }
        const idToken = await user.getIdToken();
        listener({ uid: user.uid, idToken, isAnonymous: user.isAnonymous });
      });
    },
    async refreshIdToken() {
      const user = auth().currentUser;
      if (user === null) return null;
      return user.getIdToken(true);
    },
    async ensureAnonymousSession() {
      // 永続化された認証情報の復元完了を待ってから判定する。
      // RootLayout 起動直後は currentUser が null でも復元処理が走っていることがあり、
      // 待たずに signInAnonymously を呼ぶと永続ユーザーを上書きするレースになる。
      await waitForAuthRestore();
      if (auth().currentUser !== null) return;
      await auth().signInAnonymously();
    },
  };
}

async function waitForAuthRestore(): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = auth().onAuthStateChanged(() => {
      unsubscribe();
      resolve();
    });
  });
}

/** RootLayout の初期化で一度だけ呼ぶ。 */
export function initializeFirebaseAuth(): void {
  registerAuthImpl(createFirebaseAuthImpl());
}

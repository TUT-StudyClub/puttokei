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
        listener({ uid: user.uid, idToken });
      });
    },
    async refreshIdToken() {
      const user = auth().currentUser;
      if (user === null) return null;
      return user.getIdToken(true);
    },
  };
}

/** RootLayout の初期化で一度だけ呼ぶ。 */
export function initializeFirebaseAuth(): void {
  registerAuthImpl(createFirebaseAuthImpl());
}

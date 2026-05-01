/**
 * ルートレイアウト。Tamagui と TanStack Query の Provider を組み込み、
 * AuthGate で認証 / チュートリアル状態に応じたリダイレクトを行う。
 *
 * Firebase ID Token 周りの配線もここで行う。
 * - `setTokenProvider`: API リクエスト毎に最新の ID Token を Authorization に差し込む
 * - `setTokenRefresher`: 401 を受けた際に Firebase から ID Token を再取得させる
 * - `subscribeIdTokenChanged`: Firebase の onIdTokenChanged を購読して authStore に反映する
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../tamagui.config';
import { configureGoogleSignIn } from '@/features/auth/lib/signInWithGoogle';
import { AuthGate } from '@/shared/components/AuthGate';
import { refreshIdToken, subscribeIdTokenChanged } from '@/shared/lib/firebase';
import { installDevMockAuth } from '@/shared/lib/devMockAuth';
import { initializeFirebaseAuth } from '@/shared/lib/firebaseAuth';
import { setTokenProvider, setTokenRefresher } from '@/shared/lib/api';
import { queryClient } from '@/shared/lib/queryClient';
import { getAuthIdToken, useAuthStore } from '@/shared/stores/authStore';

// 開発ビルド (__DEV__) では Firebase Auth の代わりに dev mock を使い、サインイン画面を
// 経由せずに固定 UID で API を叩く。バックエンドの DEV_MOCK_AUTH_ENABLED=true と対応。
const USE_DEV_MOCK_AUTH = false;

export default function RootLayout() {
  useEffect(() => {
    if (USE_DEV_MOCK_AUTH) {
      installDevMockAuth();
    } else {
      initializeFirebaseAuth();
    }
    configureGoogleSignIn();
    setTokenProvider(() => getAuthIdToken());
    setTokenRefresher(() => refreshIdToken());

    const unsubscribe = subscribeIdTokenChanged((session) => {
      const { setSession, clear } = useAuthStore.getState();
      if (session === null) {
        clear();
      } else {
        setSession(session.uid, session.idToken);
      }
    });

    return () => {
      unsubscribe();
      setTokenRefresher(null);
    };
  }, []);

  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
        </AuthGate>
      </QueryClientProvider>
    </TamaguiProvider>
  );
}

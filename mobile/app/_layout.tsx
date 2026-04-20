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
import { installDevMockAuth } from '@/shared/lib/devMockAuth';
import { refreshIdToken, subscribeIdTokenChanged } from '@/shared/lib/firebase';
import { initializeFirebaseAuth } from '@/shared/lib/firebaseAuth';
import { setTokenProvider, setTokenRefresher } from '@/shared/lib/api';
import { queryClient } from '@/shared/lib/queryClient';
import { getAuthIdToken, useAuthStore } from '@/shared/stores/authStore';

export default function RootLayout() {
  useEffect(() => {
    initializeFirebaseAuth();
    configureGoogleSignIn();
    // DEV ビルド時のみ dev-mock 認証を差し込む (バックエンドは DEV_MOCK_AUTH_ENABLED=true が前提)。
    // Firebase Anonymous Auth を実装したら本行を撤去する。
    if (__DEV__) {
      installDevMockAuth();
    }
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

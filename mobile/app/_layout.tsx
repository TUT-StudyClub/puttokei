/**
 * ルートレイアウト。Tamagui と TanStack Query の Provider を組み込み、
 * AuthGate で認証 / チュートリアル状態に応じたリダイレクトを行う。
 *
 * Firebase ID Token 周りの配線もここで行う。
 * - `setTokenProvider`: API リクエスト毎に最新の ID Token を Authorization に差し込む
 * - `setTokenRefresher`: 401 を受けた際に Firebase から ID Token を再取得させる
 * - `subscribeIdTokenChanged`: Firebase の onIdTokenChanged を購読して authStore に反映する
 * - `ensureAnonymousSession`: 未サインイン時に匿名 UID を作成し、登録なし利用を可能にする
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../tamagui.config';
import { configureGoogleSignIn } from '@/features/auth/lib/signInWithGoogle';
import { AuthGate } from '@/shared/components/AuthGate';
import {
  ensureAnonymousSession,
  refreshIdToken,
  subscribeIdTokenChanged,
} from '@/shared/lib/firebase';
import { installDevMockAuth } from '@/shared/lib/devMockAuth';
import { initializeFirebaseAuth } from '@/shared/lib/firebaseAuth';
import { setTokenProvider, setTokenRefresher } from '@/shared/lib/api';
import { queryClient } from '@/shared/lib/queryClient';
import { getAuthIdToken, useAuthStore } from '@/shared/stores/authStore';

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
        // 初回起動 / signOut / token 期限切れのいずれでも未サインイン状態に陥った場合は
        // 匿名で接続し直し、未登録ユーザーでもタイマー / LLM 判定を継続できるようにする。
        void ensureAnonymousSession();
      } else {
        setSession(session.uid, session.idToken, session.isAnonymous);
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

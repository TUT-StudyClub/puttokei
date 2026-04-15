/**
 * ルートレイアウト。Tamagui と TanStack Query の Provider を組み込み、
 * AuthGate で認証 / オンボーディング状態に応じたリダイレクトを行う。
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../tamagui.config';
import { AuthGate } from '@/shared/components/AuthGate';
import { setTokenProvider } from '@/shared/lib/api';
import { queryClient } from '@/shared/lib/queryClient';
import { getAuthIdToken } from '@/shared/stores/authStore';

export default function RootLayout() {
  useEffect(() => {
    setTokenProvider(() => getAuthIdToken());
  }, []);

  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </QueryClientProvider>
    </TamaguiProvider>
  );
}

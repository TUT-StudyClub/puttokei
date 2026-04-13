/**
 * ルートレイアウト。Tamagui と TanStack Query の Provider をここで組み込む。
 * 認証ガードや SplashScreen 制御は Epic #2 / #3 で追加する。
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';

import config from '../tamagui.config';
import { queryClient } from '@/shared/lib/queryClient';

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </TamaguiProvider>
  );
}

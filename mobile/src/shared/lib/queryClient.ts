/**
 * TanStack Query の QueryClient。
 * デフォルトの retry / staleTime はセッション系 API の特性に合わせて後続 Epic で調整する。
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
});

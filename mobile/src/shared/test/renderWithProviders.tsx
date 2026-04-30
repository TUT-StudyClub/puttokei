import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../tamagui.config';

type RenderWithProvidersOptions = RenderOptions & {
  queryClient?: QueryClient | false;
};

export function createTestQueryClient(config: QueryClientConfig = {}) {
  return new QueryClient({
    ...config,
    defaultOptions: {
      queries: { retry: false, ...config.defaultOptions?.queries },
      mutations: { retry: false, ...config.defaultOptions?.mutations },
    },
  });
}

function TestProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient | false;
}) {
  const content =
    queryClient === false ? (
      children
    ) : (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

  return (
    <TamaguiProvider config={config} defaultTheme="light">
      {content}
    </TamaguiProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...renderOptions }: RenderWithProvidersOptions = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <TestProviders queryClient={queryClient}>{children}</TestProviders>,
    ...renderOptions,
  });
}

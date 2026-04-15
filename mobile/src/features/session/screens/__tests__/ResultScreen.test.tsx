/**
 * ResultScreen の振る舞いを検証する。
 * JudgmentCard が表示され、「ホームへ戻る」ボタンで `/(tabs)` に replace 遷移する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { ResultScreen } from '@/features/session/screens/ResultScreen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </TamaguiProvider>,
  );
}

describe('ResultScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('判定結果カードと「ホームへ戻る」ボタンがレンダリングされる', () => {
    const { getByText, getByTestId } = renderWithProviders(<ResultScreen />);
    expect(getByText('判定結果')).toBeTruthy();
    expect(getByTestId('result-back-home')).toBeTruthy();
  });

  it('「ホームへ戻る」押下で `/(tabs)` に replace 遷移する', () => {
    const { getByTestId } = renderWithProviders(<ResultScreen />);
    fireEvent.press(getByTestId('result-back-home'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});

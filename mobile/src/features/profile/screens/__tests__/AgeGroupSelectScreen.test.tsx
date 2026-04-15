/**
 * AgeGroupSelectScreen の基本的な振る舞いを検証する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as profileApi from '@/features/profile/api/profileApi';
import { AgeGroupSelectScreen } from '@/features/profile/screens/AgeGroupSelectScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('@/features/profile/api/profileApi');

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </TamaguiProvider>,
  );
}

describe('AgeGroupSelectScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('年代未選択のまま送信しても updateMyProfile は呼ばれない', async () => {
    const { getByTestId } = renderWithProviders(<AgeGroupSelectScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('age-group-submit'));
    });
    expect(profileApi.updateMyProfile).not.toHaveBeenCalled();
  });

  it('年代を選んで送信すると updateMyProfile が呼ばれる', async () => {
    (profileApi.updateMyProfile as jest.Mock).mockResolvedValue({
      age_group: '20s',
      onboarding_completed: true,
    });

    const { getByTestId } = renderWithProviders(<AgeGroupSelectScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('age-group-20s'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('age-group-submit'));
    });

    await waitFor(() => {
      expect(profileApi.updateMyProfile).toHaveBeenCalledWith({ age_group: '20s' });
    });
  });
});

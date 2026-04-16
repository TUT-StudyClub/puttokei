/**
 * ProfileEditScreen の振る舞いを検証する。
 * - useProfile の取得が完了すると初期値がフォームに入ること
 * - 値を変更して保存すると updateMyProfile が呼ばれ、router.back が実行されること
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import * as profileApi from '@/features/profile/api/profileApi';
import { ProfileEditScreen } from '@/features/profile/screens/ProfileEditScreen';
import { useAuthStore } from '@/shared/stores/authStore';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/features/profile/api/profileApi');

const PROFILE_FIXTURE = {
  id: 'u-1',
  firebase_uid: 'fuid-1',
  auth_provider: 'google' as const,
  display_name: '太郎',
  age_group: '30s' as const,
  onboarding_completed: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

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

describe('ProfileEditScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ uid: 'u-1', idToken: 'token-1' });
    (profileApi.fetchMyProfile as jest.Mock).mockResolvedValue(PROFILE_FIXTURE);
    (profileApi.updateMyProfile as jest.Mock).mockResolvedValue({
      ...PROFILE_FIXTURE,
      display_name: '次郎',
    });
  });

  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it('取得完了後に display_name が初期値として入る', async () => {
    const { findByTestId } = renderWithProviders(<ProfileEditScreen />);

    const input = await findByTestId('profile-display-name');
    await waitFor(() => {
      expect(input.props.value).toBe('太郎');
    });
  });

  it('display_name を変更して保存すると updateMyProfile が呼ばれ、router.back が実行される', async () => {
    const { findByTestId } = renderWithProviders(<ProfileEditScreen />);

    const input = await findByTestId('profile-display-name');
    await waitFor(() => {
      expect(input.props.value).toBe('太郎');
    });

    fireEvent.changeText(input, '次郎');
    const saveButton = await findByTestId('profile-edit-save');
    await act(async () => {
      fireEvent.press(saveButton);
    });

    await waitFor(() => {
      expect(profileApi.updateMyProfile).toHaveBeenCalledWith({
        display_name: '次郎',
        age_group: '30s',
      });
    });
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('display_name を空文字にして保存すると null として送信される', async () => {
    const { findByTestId } = renderWithProviders(<ProfileEditScreen />);

    const input = await findByTestId('profile-display-name');
    await waitFor(() => {
      expect(input.props.value).toBe('太郎');
    });

    fireEvent.changeText(input, '');
    const saveButton = await findByTestId('profile-edit-save');
    await act(async () => {
      fireEvent.press(saveButton);
    });

    await waitFor(() => {
      expect(profileApi.updateMyProfile).toHaveBeenCalledWith({
        display_name: null,
        age_group: '30s',
      });
    });
  });
});

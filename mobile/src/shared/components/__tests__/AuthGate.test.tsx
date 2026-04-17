import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../tamagui.config';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { AuthGate } from '@/shared/components/AuthGate';
import { BOOT_SCREEN_MIN_DURATION_MS } from '@/shared/components/BootScreen';
import { hideSplashWhenReady } from '@/shared/lib/splash';
import { useAuthStore } from '@/shared/stores/authStore';
import type { UserProfile } from '@/shared/types/user';

const mockReplace = jest.fn();
let mockSegments: string[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegments,
}));

jest.mock('@/features/profile/hooks/useProfile');
jest.mock('@/shared/lib/splash', () => ({
  hideSplashWhenReady: jest.fn(),
}));

const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockHideSplashWhenReady = hideSplashWhenReady as jest.MockedFunction<
  typeof hideSplashWhenReady
>;

const ONBOARDED_PROFILE: UserProfile = {
  id: 'user-1',
  firebase_uid: 'firebase-user-1',
  auth_provider: 'apple',
  display_name: 'Hourglass User',
  age_group: '20s',
  onboarding_completed: true,
  created_at: '2026-04-17T00:00:00Z',
  updated_at: '2026-04-17T00:00:00Z',
};

function renderAuthGate() {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      <AuthGate>
        <Text>child</Text>
      </AuthGate>
    </TamaguiProvider>,
  );
}

describe('AuthGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSegments = [];
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
    });
    mockUseProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useProfile>);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
    });
    jest.useRealTimers();
  });

  it('未認証でも一定時間はブート画面を表示する', async () => {
    const screen = renderAuthGate();

    await waitFor(() => {
      expect(mockHideSplashWhenReady).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');

    expect(screen.getByTestId('boot-screen')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(BOOT_SCREEN_MIN_DURATION_MS - 1);
    });
    expect(screen.getByTestId('boot-screen')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('boot-screen')).toBeNull();
    });
  });

  it('認証済みでプロフィール取得中は最低時間経過後もブート画面を維持する', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'user-1', idToken: 'token-1' });
    });
    mockSegments = ['(auth)'];
    mockUseProfile.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useProfile>);

    const screen = renderAuthGate();

    expect(mockHideSplashWhenReady).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalledWith('/(tabs)');
    act(() => {
      jest.advanceTimersByTime(BOOT_SCREEN_MIN_DURATION_MS);
    });
    expect(screen.getByTestId('boot-screen')).toBeTruthy();

    mockUseProfile.mockReturnValue({
      data: ONBOARDED_PROFILE,
      isLoading: false,
    } as ReturnType<typeof useProfile>);
    screen.rerender(
      <TamaguiProvider config={config} defaultTheme="light">
        <AuthGate>
          <Text>child</Text>
        </AuthGate>
      </TamaguiProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('boot-screen')).toBeNull();
    });
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../tamagui.config';
import { signOut } from '@/features/auth/lib/signOut';
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

jest.mock('@/features/profile/hooks/useProfile', () => {
  const actual = jest.requireActual('@/features/profile/hooks/useProfile');
  return {
    ...actual,
    useProfile: jest.fn(),
  };
});
jest.mock('@/shared/lib/splash', () => ({
  hideSplashWhenReady: jest.fn(),
}));
jest.mock('@/features/auth/lib/signOut', () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
}));

const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockHideSplashWhenReady = hideSplashWhenReady as jest.MockedFunction<
  typeof hideSplashWhenReady
>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;

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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <TamaguiProvider config={config} defaultTheme="light">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TamaguiProvider>
  );
  return { queryClient, Wrapper };
}

function renderAuthGate() {
  const { queryClient, Wrapper } = createWrapper();
  const utils = render(
    <Wrapper>
      <AuthGate>
        <Text>child</Text>
      </AuthGate>
    </Wrapper>,
  );
  return { ...utils, queryClient, Wrapper };
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
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useProfile>);
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
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useProfile>);

    const { Wrapper, ...screen } = renderAuthGate();

    expect(mockHideSplashWhenReady).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalledWith('/(tabs)');
    act(() => {
      jest.advanceTimersByTime(BOOT_SCREEN_MIN_DURATION_MS);
    });
    expect(screen.getByTestId('boot-screen')).toBeTruthy();

    mockUseProfile.mockReturnValue({
      data: ONBOARDED_PROFILE,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useProfile>);
    screen.rerender(
      <Wrapper>
        <AuthGate>
          <Text>child</Text>
        </AuthGate>
      </Wrapper>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('boot-screen')).toBeNull();
    });
  });

  it('認証済みだがプロフィール取得が失敗したらエラー画面を表示する', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'user-1', idToken: 'token-1' });
    });
    mockSegments = ['(auth)'];
    mockUseProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('HTTP 401'),
    } as unknown as ReturnType<typeof useProfile>);

    const { queryClient, ...screen } = renderAuthGate();
    const removeSpy = jest.spyOn(queryClient, 'removeQueries');

    act(() => {
      jest.advanceTimersByTime(BOOT_SCREEN_MIN_DURATION_MS);
    });

    await waitFor(() => {
      expect(screen.getByTestId('profile-error-screen')).toBeTruthy();
    });
    expect(screen.queryByTestId('boot-screen')).toBeNull();

    fireEvent.press(screen.getByTestId('profile-error-sign-out'));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    // signOut 成功後にキャッシュを除去する順序を担保する
    expect(mockSignOut.mock.invocationCallOrder[0]).toBeLessThan(
      removeSpy.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(removeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['profile', 'me'] }),
    );
  });

  it('signOut が失敗したらキャッシュを除去せず、エラー画面に留まる', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'user-1', idToken: 'token-1' });
    });
    mockSegments = ['(auth)'];
    mockUseProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('HTTP 401'),
    } as unknown as ReturnType<typeof useProfile>);

    mockSignOut.mockRejectedValueOnce(new Error('network unavailable'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { queryClient, ...screen } = renderAuthGate();
    const removeSpy = jest.spyOn(queryClient, 'removeQueries');

    act(() => {
      jest.advanceTimersByTime(BOOT_SCREEN_MIN_DURATION_MS);
    });

    await waitFor(() => {
      expect(screen.getByTestId('profile-error-screen')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('profile-error-sign-out'));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('signOut failed', expect.any(Error));
    });

    expect(removeSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('profile-error-screen')).toBeTruthy();

    warnSpy.mockRestore();
  });

  it('エラー画面で再試行ボタンを押すと profile query が invalidate される', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'user-1', idToken: 'token-1' });
    });
    mockSegments = ['(auth)'];
    mockUseProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('HTTP 500'),
    } as unknown as ReturnType<typeof useProfile>);

    const { queryClient, ...screen } = renderAuthGate();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      jest.advanceTimersByTime(BOOT_SCREEN_MIN_DURATION_MS);
    });

    await waitFor(() => {
      expect(screen.getByTestId('profile-error-retry')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('profile-error-retry'));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['profile', 'me'] }),
    );
  });
});

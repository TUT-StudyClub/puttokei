import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../tamagui.config';
import { AuthGate } from '@/app/AuthGate';
import { signOut } from '@/features/auth/lib/signOut';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { BOOT_SCREEN_MIN_DURATION_MS } from '@/shared/components/BootScreen';
import { hideSplashWhenReady } from '@/shared/lib/splash';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

const mockReplace = jest.fn();
let mockSegments: string[] = [];
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegments,
  useGlobalSearchParams: () => mockParams,
}));

jest.mock('@/shared/lib/splash', () => ({
  hideSplashWhenReady: jest.fn(),
}));

jest.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: jest.fn(),
}));

jest.mock('@/features/auth/lib/signOut', () => ({
  signOut: jest.fn(),
}));

const mockHideSplashWhenReady = hideSplashWhenReady as jest.MockedFunction<
  typeof hideSplashWhenReady
>;
const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;

function mockProfileQuery(overrides: Record<string, unknown> = {}) {
  mockUseProfile.mockReturnValue({
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useProfile>);
}

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
    mockParams = {};
    mockProfileQuery();
    mockSignOut.mockResolvedValue();
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
      useTutorialStore.getState().reset();
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    act(() => {
      useAuthStore.setState({ uid: null, idToken: null });
      useTutorialStore.getState().reset();
    });
    jest.useRealTimers();
  });

  it('起動直後はブート画面を表示し、最小時間経過後に消える', async () => {
    const screen = renderAuthGate();

    await waitFor(() => {
      expect(mockHideSplashWhenReady).toHaveBeenCalledTimes(1);
    });
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

  it('チュートリアル未完了 & 未認証 → overview へ遷移する', async () => {
    mockSegments = ['(tabs)'];

    renderAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/overview');
    });
  });

  it('チュートリアル未完了 & 認証済でも overview へ遷移する (dev-mock でも必ず表示)', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'dev-local-user', idToken: 'dev-mock-dev-local-user' });
    });
    mockSegments = ['(tabs)'];

    renderAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/overview');
    });
  });

  it('チュートリアル完了 & 未認証 → (tabs) 配下に滞在できる', async () => {
    mockSegments = ['(tabs)'];
    act(() => {
      useTutorialStore.getState().markCompleted();
    });

    renderAuthGate();

    await waitFor(() => {
      expect(mockHideSplashWhenReady).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('チュートリアル完了 & 認証済 & (auth) 配下 → (tabs) へ抜ける', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'dev-local-user', idToken: 'dev-mock-dev-local-user' });
      useTutorialStore.getState().markCompleted();
    });
    mockSegments = ['(auth)'];

    renderAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('チュートリアル完了 & 認証済 & (auth) 配下 & returnTo 指定あり → returnTo へ抜ける', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'apple-user', idToken: 'apple-token' });
      useTutorialStore.getState().markCompleted();
    });
    mockSegments = ['(auth)'];
    mockParams = { returnTo: '/(tabs)/stats' };

    renderAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/stats');
    });
  });

  it('チュートリアル完了 & 認証済 & (auth) 配下 & 許可外 returnTo 指定あり → (tabs) へ抜ける', async () => {
    act(() => {
      useAuthStore.setState({ uid: 'apple-user', idToken: 'apple-token' });
      useTutorialStore.getState().markCompleted();
    });
    mockSegments = ['(auth)'];
    mockParams = { returnTo: 'https://example.com' };

    renderAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('認証済みでプロフィール取得に失敗したら全画面エラーを表示し、再試行できる', async () => {
    const refetch = jest.fn();
    mockProfileQuery({
      isError: true,
      error: new Error('profile failed'),
      refetch,
    });
    act(() => {
      useAuthStore.setState({ uid: 'apple-user', idToken: 'apple-token' });
      useTutorialStore.getState().markCompleted();
    });
    mockSegments = ['(tabs)'];

    const screen = renderAuthGate();

    expect(screen.getByTestId('profile-error-screen')).toBeTruthy();
    expect(screen.getByText('profile failed')).toBeTruthy();

    fireEvent.press(screen.getByTestId('profile-error-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('プロフィール取得失敗画面のサインアウトで Firebase signOut を呼ぶ', async () => {
    mockProfileQuery({
      isError: true,
      error: new Error('profile failed'),
      refetch: jest.fn(),
    });
    act(() => {
      useAuthStore.setState({ uid: 'apple-user', idToken: 'apple-token' });
      useTutorialStore.getState().markCompleted();
    });
    mockSegments = ['(tabs)'];

    const screen = renderAuthGate();

    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-error-sign-out'));
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

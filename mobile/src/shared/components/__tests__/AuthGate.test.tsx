import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../tamagui.config';
import { AuthGate } from '@/shared/components/AuthGate';
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

const mockHideSplashWhenReady = hideSplashWhenReady as jest.MockedFunction<
  typeof hideSplashWhenReady
>;

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
});

/**
 * OverviewScreen の初期表示とボタン遷移を検証する。
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { OverviewScreen } from '@/features/auth/screens/OverviewScreen';
import { TUTORIAL_ROUTE_TRANSITION_DELAY_MS } from '@/features/auth/screens/tutorialConfig';
import { ensureAnonymousSession } from '@/shared/lib/firebase';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/shared/lib/firebase', () => ({
  ensureAnonymousSession: jest.fn().mockResolvedValue(undefined),
}));

const mockedEnsureAnonymousSession = ensureAnonymousSession as jest.Mock;

function renderWithProviders(ui: ReactNode) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}

describe('OverviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('概要ヒーローを表示する', () => {
    const screen = renderWithProviders(<OverviewScreen />);

    expect(screen.getByTestId('overview-root')).toBeTruthy();
    expect(screen.getByTestId('overview-heading')).toBeTruthy();
    expect(screen.getByTestId('overview-logo')).toBeTruthy();
    expect(screen.getByTestId('overview-welcome')).toBeTruthy();
    expect(screen.getByText('へようこそ')).toBeTruthy();
    expect(screen.getByTestId('overview-description')).toBeTruthy();
    expect(screen.getByText(/インプットとアウトプットを/)).toBeTruthy();
    expect(screen.getByTestId('overview-next')).toBeTruthy();
    expect(screen.getByText('はじめる')).toBeTruthy();
  });

  it('次へは少し待ってから匿名 sign-in を実行し、チュートリアル Step1 へ進む', async () => {
    const screen = renderWithProviders(<OverviewScreen />);

    fireEvent.press(screen.getByTestId('overview-next'));

    expect(mockedEnsureAnonymousSession).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(TUTORIAL_ROUTE_TRANSITION_DELAY_MS - 1);
    });
    expect(mockedEnsureAnonymousSession).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(mockedEnsureAnonymousSession).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/tutorial-step-one');
    });
  });

  it('匿名 sign-in に失敗した場合は遷移せずボタンが再度押せるようになる', async () => {
    mockedEnsureAnonymousSession.mockRejectedValueOnce(new Error('network down'));
    const screen = renderWithProviders(<OverviewScreen />);

    fireEvent.press(screen.getByTestId('overview-next'));
    act(() => {
      jest.advanceTimersByTime(TUTORIAL_ROUTE_TRANSITION_DELAY_MS);
    });

    await waitFor(() => {
      expect(mockedEnsureAnonymousSession).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).not.toHaveBeenCalled();

    // 再度ボタンが効くこと (isNavigating が false に戻った検証)
    mockedEnsureAnonymousSession.mockResolvedValueOnce(undefined);
    fireEvent.press(screen.getByTestId('overview-next'));
    act(() => {
      jest.advanceTimersByTime(TUTORIAL_ROUTE_TRANSITION_DELAY_MS);
    });
    await waitFor(() => {
      expect(mockedEnsureAnonymousSession).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/tutorial-step-one');
    });
  });
});

/**
 * OverviewScreen の初期表示と自動遷移を検証する。
 */
import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import {
  OVERVIEW_SCREEN_DURATION_MS,
  OverviewScreen,
} from '@/features/auth/screens/OverviewScreen';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

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
  });

  it('一定時間後にサインイン画面へ置き換え遷移する', () => {
    renderWithProviders(<OverviewScreen />);

    act(() => {
      jest.advanceTimersByTime(OVERVIEW_SCREEN_DURATION_MS - 1);
    });
    expect(mockReplace).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});

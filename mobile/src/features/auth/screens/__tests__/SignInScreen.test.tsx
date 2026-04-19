/**
 * SignInScreen の初期表示とスキップ導線を検証する。
 */
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';

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

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('サインイン導線のヒーローとボタンを表示する', () => {
    const screen = renderWithProviders(<SignInScreen />);

    expect(screen.getByTestId('sign-in-root')).toBeTruthy();
    expect(screen.getByTestId('sign-in-logo')).toBeTruthy();
    expect(screen.getByTestId('sign-in-title')).toBeTruthy();
    expect(screen.getByText(/アカウントを作って/)).toBeTruthy();
    expect(screen.getByText(/学習の成果を振り返りましょう/)).toBeTruthy();
    expect(screen.getByText('会員登録後レポート機能を使用できます')).toBeTruthy();
    expect(screen.getByTestId('sign-in-apple')).toBeTruthy();
    expect(screen.getByText('Appleで続ける')).toBeTruthy();
    expect(screen.getByTestId('sign-in-google')).toBeTruthy();
    expect(screen.getByText('Googleで続ける')).toBeTruthy();
    expect(screen.getByText('利用規約・プライバシーポリシー')).toBeTruthy();
    expect(screen.getByTestId('sign-in-skip')).toBeTruthy();
    expect(screen.getByText('あとで')).toBeTruthy();
  });

  it('あとでを押すとタブ画面へ置き換え遷移する', () => {
    const screen = renderWithProviders(<SignInScreen />);

    fireEvent.press(screen.getByTestId('sign-in-skip'));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});

/**
 * SignInScreen の初期表示・サインイン導線・スキップ導線を検証する。
 */
import { cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('../../hooks/useSignIn', () => ({
  useSignIn: jest.fn(),
}));

const { SignInScreen } = require('../SignInScreen') as typeof import('../SignInScreen');
const { useSignIn } = require('../../hooks/useSignIn') as typeof import('../../hooks/useSignIn');

const mockUseSignIn = useSignIn as jest.MockedFunction<typeof useSignIn>;

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
    mockUseSignIn.mockReturnValue({
      loading: false,
      error: null,
      signInWithApple: jest.fn(),
      signInWithGoogle: jest.fn(),
      clearError: jest.fn(),
    });
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

  it('Google ボタン押下で Google サインイン処理を呼ぶ', () => {
    const signInWithGoogle = jest.fn();
    mockUseSignIn.mockReturnValue({
      loading: false,
      error: null,
      signInWithApple: jest.fn(),
      signInWithGoogle,
      clearError: jest.fn(),
    });

    const screen = renderWithProviders(<SignInScreen />);
    fireEvent.press(screen.getByTestId('sign-in-google'));

    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('Apple ボタン押下で Apple サインイン処理を呼ぶ', () => {
    const signInWithApple = jest.fn();
    mockUseSignIn.mockReturnValue({
      loading: false,
      error: null,
      signInWithApple,
      signInWithGoogle: jest.fn(),
      clearError: jest.fn(),
    });

    const screen = renderWithProviders(<SignInScreen />);
    fireEvent.press(screen.getByTestId('sign-in-apple'));

    expect(signInWithApple).toHaveBeenCalledTimes(1);
  });

  it('エラーが渡されたら赤文字で表示し、タップで clearError を呼ぶ', () => {
    const clearError = jest.fn();
    mockUseSignIn.mockReturnValue({
      loading: false,
      error: '認証に失敗しました',
      signInWithApple: jest.fn(),
      signInWithGoogle: jest.fn(),
      clearError,
    });

    const screen = renderWithProviders(<SignInScreen />);
    expect(screen.getByText('認証に失敗しました')).toBeTruthy();

    fireEvent.press(screen.getByTestId('sign-in-error'));
    expect(clearError).toHaveBeenCalledTimes(1);
  });

  it('あとでを押すとタブ画面へ置き換え遷移する', () => {
    const screen = renderWithProviders(<SignInScreen />);

    fireEvent.press(screen.getByTestId('sign-in-skip'));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});

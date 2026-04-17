/**
 * SignInScreen の表示と操作を検証する。
 */
import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';

jest.mock('../../hooks/useSignIn', () => ({
  useSignIn: jest.fn(),
}));

const { SignInScreen } = require('../SignInScreen') as typeof import('../SignInScreen');
const { useSignIn } = require('../../hooks/useSignIn') as typeof import('../../hooks/useSignIn');

const mockUseSignIn = useSignIn as jest.MockedFunction<typeof useSignIn>;

function renderScreen() {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      <SignInScreen />
    </TamaguiProvider>,
  );
}

describe('SignInScreen', () => {
  const originalPlatform = Platform.OS;

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
    Object.defineProperty(Platform, 'OS', { value: originalPlatform });
  });

  it('iOS では Apple / Google サインイン導線を表示する', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });

    const { getByTestId } = renderScreen();

    expect(getByTestId('sign-in-apple')).toBeTruthy();
    expect(getByTestId('sign-in-google')).toBeTruthy();
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

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('sign-in-google'));

    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('エラー表示を押すと clearError を呼ぶ', () => {
    const clearError = jest.fn();
    mockUseSignIn.mockReturnValue({
      loading: false,
      error: '認証に失敗しました',
      signInWithApple: jest.fn(),
      signInWithGoogle: jest.fn(),
      clearError,
    });

    const { getByText } = renderScreen();
    fireEvent.press(getByText('認証に失敗しました'));

    expect(clearError).toHaveBeenCalledTimes(1);
  });
});

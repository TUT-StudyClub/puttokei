/**
 * SignInScreen の初期表示を検証する。
 */
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';

function renderWithProviders(ui: ReactNode) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}

describe('SignInScreen', () => {
  it('概要ヒーローを表示する', () => {
    const screen = renderWithProviders(<SignInScreen />);

    expect(screen.getByTestId('sign-in-root')).toBeTruthy();
    expect(screen.getByTestId('sign-in-heading')).toBeTruthy();
    expect(screen.getByTestId('sign-in-logo')).toBeTruthy();
    expect(screen.getByTestId('sign-in-welcome')).toBeTruthy();
    expect(screen.getByText('へようこそ')).toBeTruthy();
    expect(screen.getByTestId('sign-in-description')).toBeTruthy();
    expect(screen.getByText(/インプットとアウトプットを/)).toBeTruthy();
  });
});
